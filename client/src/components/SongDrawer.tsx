import { useEffect, useState, type FormEvent } from 'react'
import { fetchVideo, lookupBpm, searchYouTube, type BpmMatch, type VideoInfo } from '../lib/api'
import { NOTE_NAMES, parseKey } from '../lib/music'
import { addTap, bpmFromTaps } from '../lib/tapTempo'
import type { BpmSource, Member, MusicalKey, SetlistItem, Song } from '../lib/types'
import { parseYouTubeId, thumbUrl } from '../lib/youtube'
import { newId, useStore } from '../state/store'

type Target =
  | { mode: 'add'; sessionId: string }
  | { mode: 'edit'; item: SetlistItem; song: Song }

interface Props {
  target: Target
  singers: Member[]
  onClose: () => void
}

const KEY_OPTIONS = (['major', 'minor'] as const).flatMap((mode) =>
  NOTE_NAMES.map((name, tonic) => ({ value: `${tonic}-${mode}`, label: `${name} ${mode}` })))

const keyToValue = (k: MusicalKey | null) => (k ? `${k.tonic}-${k.mode}` : '')
const valueToKey = (v: string): MusicalKey | null => {
  if (!v) return null
  const [tonic, mode] = v.split('-')
  return { tonic: Number(tonic), mode: mode as MusicalKey['mode'] }
}
const toClock = (sec: number) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '')
const fromClock = (text: string) => {
  const [m, s] = text.split(':').map(Number)
  return Number.isFinite(m) ? m * 60 + (Number.isFinite(s) ? s : 0) : 0
}

export function SongDrawer({ target, singers, onClose }: Props) {
  const { dispatch } = useStore()
  const existing = target.mode === 'edit' ? target : null

  const [link, setLink] = useState(existing?.song.youtubeId ? `https://youtu.be/${existing.song.youtubeId}` : '')
  const [youtubeId, setYoutubeId] = useState<string | null>(existing?.song.youtubeId ?? null)
  const [title, setTitle] = useState(existing?.song.title ?? '')
  const [artist, setArtist] = useState(existing?.song.artist ?? '')
  const [duration, setDuration] = useState(toClock(existing?.song.durationSec ?? 0))
  const [singerId, setSingerId] = useState(existing?.item.singerId ?? '')
  const [bpm, setBpm] = useState(existing?.song.bpm?.toString() ?? '')
  const [bpmSource, setBpmSource] = useState<BpmSource | null>(existing?.song.bpmSource ?? null)
  const [keyValue, setKeyValue] = useState(keyToValue(existing?.song.key ?? null))
  const [transpose, setTranspose] = useState(existing?.item.transpose ?? 0)
  const [notes, setNotes] = useState(existing?.item.notes ?? '')

  const [status, setStatus] = useState<string | null>(null)
  const [results, setResults] = useState<VideoInfo[]>([])
  const [matches, setMatches] = useState<BpmMatch[]>([])
  const [taps, setTaps] = useState<number[]>([])
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function applyVideo(v: VideoInfo) {
    setYoutubeId(v.youtubeId)
    setLink(`https://youtu.be/${v.youtubeId}`)
    if (!title) setTitle(v.title)
    if (!artist) setArtist(v.channel.replace(/(VEVO| - Topic)$/i, '').trim())
    if (v.durationSec) setDuration(toClock(v.durationSec))
    setResults([])
  }

  async function onLinkOrSearch() {
    const id = parseYouTubeId(link)
    setStatus(id ? 'Reading the video…' : 'Searching YouTube…')
    try {
      if (id) {
        setYoutubeId(id)
        applyVideo(await fetchVideo(id))
        setStatus(null)
      } else {
        const found = await searchYouTube(link)
        setResults(found)
        setStatus(found.length ? null : 'No videos found. Try different words.')
      }
    } catch (err) {
      if (id) setYoutubeId(id)
      setStatus(`${(err as Error).message}. You can still fill in the details by hand.`)
    }
  }

  async function onLookupBpm() {
    if (!title) return setStatus('Enter the song title first.')
    setStatus('Looking up BPM and key…')
    try {
      const found = await lookupBpm(title, artist)
      setMatches(found)
      setStatus(found.length ? null : 'Not in the BPM database. Tap along to set the tempo.')
    } catch (err) {
      setStatus(`${(err as Error).message}. Tap along to set the tempo.`)
    }
  }

  function applyMatch(m: BpmMatch) {
    if (m.bpm) { setBpm(String(m.bpm)); setBpmSource('lookup') }
    const k = m.key ? parseKey(m.key) : null
    if (k) setKeyValue(keyToValue(k))
    setMatches([])
  }

  function onTap() {
    const next = addTap(taps, performance.now())
    setTaps(next)
    const value = bpmFromTaps(next)
    if (value) { setBpm(String(value)); setBpmSource('tap') }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setStatus('The song needs a title.')
    const songFields = {
      title: title.trim(),
      artist: artist.trim(),
      youtubeId,
      durationSec: fromClock(duration),
      bpm: bpm ? Math.round(Number(bpm)) : null,
      key: valueToKey(keyValue),
      bpmSource: bpm ? (bpmSource ?? 'manual') : null,
    }
    const itemFields = { singerId: singerId || null, transpose, notes }

    if (target.mode === 'add') {
      const song: Song = { id: newId('song'), ...songFields }
      dispatch({ type: 'addSongToSession', sessionId: target.sessionId, song, item: { id: newId('item'), songId: song.id, ...itemFields } })
    } else {
      dispatch({ type: 'updateSong', songId: target.song.id, patch: songFields })
      dispatch({ type: 'updateItem', itemId: target.item.id, patch: itemFields })
    }
    onClose()
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <h2 id="drawer-title">{target.mode === 'add' ? 'Add song' : 'Edit song'}</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <form onSubmit={onSubmit} className="drawer__body">
          <label className="field">
            <span>YouTube link or search</span>
            <div className="field__row">
              <input
                id="song-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Paste a link, or type a song name"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onLinkOrSearch() } }}
              />
              <button type="button" className="btn" onClick={onLinkOrSearch} disabled={!link.trim()}>
                {parseYouTubeId(link) ? 'Use link' : 'Search'}
              </button>
            </div>
          </label>

          {youtubeId && (
            <div className="preview">
              <img src={thumbUrl(youtubeId)} alt="" />
              <span className="muted">Linked video: {youtubeId}</span>
            </div>
          )}

          {results.length > 0 && (
            <ul className="picker">
              {results.map((r) => (
                <li key={r.youtubeId}>
                  <button type="button" onClick={() => applyVideo(r)}>
                    <img src={thumbUrl(r.youtubeId)} alt="" />
                    <span><strong>{r.title}</strong><small>{r.channel}{r.durationSec ? ` · ${toClock(r.durationSec)}` : ''}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="field-grid">
            <label className="field"><span>Title</span><input id="song-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
            <label className="field"><span>Original artist</span><input id="song-artist" value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
            <label className="field">
              <span>Singer</span>
              <select id="song-singer" value={singerId} onChange={(e) => setSingerId(e.target.value)}>
                <option value="">No singer</option>
                {singers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Length (m:ss)</span><input id="song-duration" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="4:05" inputMode="numeric" /></label>
          </div>

          <fieldset className="tempo">
            <legend>Tempo &amp; key</legend>
            <div className="field-grid">
              <label className="field">
                <span>BPM {bpmSource && <small className="muted">({bpmSource})</small>}</span>
                <input id="song-bpm" type="number" min={30} max={300} value={bpm} onChange={(e) => { setBpm(e.target.value); setBpmSource('manual') }} />
              </label>
              <label className="field">
                <span>Key</span>
                <select id="song-key" value={keyValue} onChange={(e) => setKeyValue(e.target.value)}>
                  <option value="">Not set</option>
                  {KEY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Transpose (semitones)</span>
                <input id="song-transpose" type="number" min={-11} max={11} value={transpose} onChange={(e) => setTranspose(Number(e.target.value) || 0)} />
              </label>
            </div>
            <div className="tempo__actions">
              <button type="button" className="btn" onClick={onLookupBpm}>Look up BPM &amp; key</button>
              <button type="button" className="btn btn--tap" onClick={onTap}>
                Tap tempo {taps.length > 1 ? `· ${bpmFromTaps(taps)} BPM` : ''}
              </button>
            </div>
            {matches.length > 0 && (
              <ul className="picker picker--compact">
                {matches.map((m, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => applyMatch(m)}>
                      <span><strong>{m.title}</strong><small>{m.artist} · {m.bpm ?? '?'} BPM · {m.key ?? 'key ?'}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <label className="field"><span>Notes for the band</span><textarea id="song-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. skip 2nd verse, capo 2" /></label>

          {status && <p className="status" role="status">{status}</p>}

          <footer className="drawer__foot">
            {target.mode === 'edit' && (confirmRemove ? (
              <span className="confirm">
                Remove from this show?
                <button type="button" className="btn btn--danger" onClick={() => { dispatch({ type: 'removeItem', itemId: target.item.id }); onClose() }}>Remove</button>
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmRemove(false)}>Keep</button>
              </span>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmRemove(true)}>Remove from show</button>
            ))}
            <button type="submit" className="btn btn--primary">{target.mode === 'add' ? 'Add to session' : 'Save changes'}</button>
          </footer>
        </form>
      </aside>
    </div>
  )
}
