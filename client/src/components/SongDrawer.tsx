import { gsap } from 'gsap'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { fetchVideo, lookupBpm, searchYouTube, type BpmMatch, type VideoInfo } from '../lib/api'
import { reducedMotion, useDrawerIn } from '../lib/motion'
import { NOTE_NAMES, camelot, parseKey, suggestTranspose } from '../lib/music'
import { singerBadge } from '../lib/singers'
import { addTap, bpmFromTaps } from '../lib/tapTempo'
import type { BpmSource, Member, MusicalKey, SetlistItem, Song } from '../lib/types'
import { parseYouTubeId, thumbUrl } from '../lib/youtube'
import { newId, useStore } from '../state/store'

type Target =
  | { mode: 'add'; sessionId: string; sessionName: string }
  | { mode: 'edit'; item: SetlistItem; song: Song; sessionName: string }

interface Props {
  target: Target
  members: Member[]
  onClose: () => void
  notify: (message: string) => void
}

const KEY_OPTIONS = (['major', 'minor'] as const).flatMap((mode) =>
  NOTE_NAMES.map((name, tonic) => ({ value: `${tonic}-${mode}`, label: `${name} ${mode} · ${camelot({ tonic, mode })}` })))

const keyToValue = (k: MusicalKey | null) => (k ? `${k.tonic}-${k.mode}` : '')
const valueToKey = (v: string): MusicalKey | null => {
  if (!v) return null
  const [tonic, mode] = v.split('-')
  return { tonic: Number(tonic), mode: mode as MusicalKey['mode'] }
}
const toClock = (sec: number | null) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '')
const fromClock = (text: string) => {
  const [m, s] = text.split(':').map(Number)
  return Number.isFinite(m) ? m * 60 + (Number.isFinite(s) ? s : 0) : 0
}
const SOURCE_LABEL: Record<BpmSource, string> = {
  lookup: 'FROM GETSONGBPM', analysis: 'FROM AUDIO', tap: 'TAPPED', manual: 'TYPED IN',
}

export function SongDrawer({ target, members, onClose, notify }: Props) {
  const { dispatch } = useStore()
  const existing = target.mode === 'edit' ? target : null
  const singers = members.filter((m) => m.isSinger)

  const [phase, setPhase] = useState<'search' | 'details'>(existing ? 'details' : 'search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VideoInfo[]>([])
  const [youtubeId, setYoutubeId] = useState<string | null>(existing?.song.youtubeId ?? null)
  const [channel, setChannel] = useState('')
  const [title, setTitle] = useState(existing?.song.title ?? '')
  const [shortTitle, setShortTitle] = useState(existing?.song.shortTitle ?? '')
  const [artist, setArtist] = useState(existing?.song.artist ?? '')
  const [duration, setDuration] = useState(toClock(existing?.song.durationSec ?? null))
  const [singerId, setSingerId] = useState<string | null>(existing?.item.singerId ?? null)
  const [bpm, setBpm] = useState(existing?.song.bpm?.toString() ?? '')
  const [bpmSource, setBpmSource] = useState<BpmSource | null>(existing?.song.bpmSource ?? null)
  const [keyValue, setKeyValue] = useState(keyToValue(existing?.song.key ?? null))
  const [transpose, setTranspose] = useState(existing?.item.transpose ?? 0)
  const [notes, setNotes] = useState(existing?.item.notes ?? '')
  const [chordSheet, setChordSheet] = useState(existing?.song.chordSheet ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [matches, setMatches] = useState<BpmMatch[]>([])
  const [taps, setTaps] = useState<number[]>([])
  const [confirmRemove, setConfirmRemove] = useState(false)

  const drawerRef = useRef<HTMLElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const tapRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLFormElement>(null)
  useDrawerIn(drawerRef, scrimRef)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Fade the next step in when switching between search and details.
  useEffect(() => {
    if (reducedMotion() || !bodyRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(bodyRef.current!.children, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.03, ease: 'power2.out', clearProps: 'transform,opacity' })
    })
    return () => ctx.revert()
  }, [phase])

  function pick(v: VideoInfo) {
    setYoutubeId(v.youtubeId)
    setChannel(v.channel)
    if (!title || phase === 'search') setTitle(v.title)
    if (!artist || phase === 'search') setArtist(v.channel.replace(/(VEVO| - Topic)$/i, '').trim())
    if (v.durationSec) setDuration(toClock(v.durationSec))
    setResults([])
    setStatus(null)
    setPhase('details')
  }

  async function onSearch() {
    const text = query.trim()
    if (!text) return
    const id = parseYouTubeId(text)
    setStatus(id ? 'Reading the video…' : 'Searching YouTube…')
    try {
      if (id) pick(await fetchVideo(id))
      else {
        const found = await searchYouTube(text)
        setResults(found)
        setStatus(found.length ? null : 'No videos found. Try other words, or paste a link.')
      }
    } catch (err) {
      if (id) {
        setYoutubeId(id)
        setPhase('details')
      }
      setStatus(`${(err as Error).message}.`)
    }
  }

  async function onLookupBpm() {
    if (!title.trim()) return setStatus('Enter the song title first.')
    setStatus('Looking up BPM and key…')
    try {
      const found = await lookupBpm(title, artist)
      setMatches(found)
      setStatus(found.length ? null : 'Not on GetSongBPM — common for Sinhala tracks. Play the video and tap along; 8 taps is plenty.')
    } catch (err) {
      setStatus(`${(err as Error).message}. Tap along to set the tempo.`)
    }
  }

  function applyMatch(m: BpmMatch) {
    if (m.bpm) { setBpm(String(m.bpm)); setBpmSource('lookup') }
    const k = m.key ? parseKey(m.key) : null
    if (k) setKeyValue(keyToValue(k))
    setMatches([])
    setStatus(null)
  }

  function onTap() {
    const next = addTap(taps, performance.now())
    setTaps(next)
    const value = bpmFromTaps(next)
    if (value) { setBpm(String(value)); setBpmSource('tap') }
    if (tapRef.current && !reducedMotion()) gsap.fromTo(tapRef.current, { scale: 0.92 }, { scale: 1, duration: 0.35, ease: 'elastic.out(1.2, 0.4)' })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setStatus('The song needs a title.')
    const songFields = {
      title: title.trim(),
      shortTitle: shortTitle.trim() ? shortTitle.trim() : null,
      artist: artist.trim(),
      youtubeId,
      durationSec: fromClock(duration),
      bpm: bpm ? Math.round(Number(bpm)) : null,
      key: valueToKey(keyValue),
      bpmSource: bpm ? (bpmSource ?? 'manual') : null,
      chordSheet: chordSheet.trim() ? chordSheet : null,
    }
    const itemFields = { singerId, transpose, notes }
    if (target.mode === 'add') {
      const song: Song = { id: newId('song'), ...songFields }
      dispatch({ type: 'addSongToSession', sessionId: target.sessionId, song, item: { id: newId('item'), songId: song.id, ...itemFields } })
      notify(`Added “${song.title}” to ${target.sessionName}`)
    } else {
      dispatch({ type: 'updateSong', songId: target.song.id, patch: songFields })
      dispatch({ type: 'updateItem', itemId: target.item.id, patch: itemFields })
      notify(`Saved “${songFields.title}”`)
    }
    onClose()
  }

  const key = valueToKey(keyValue)
  const playedKey = key ? { tonic: (((key.tonic + transpose) % 12) + 12) % 12, mode: key.mode } : null
  const tapBpm = bpmFromTaps(taps)
  const singerRange = members.find((m) => m.id === singerId)?.keyRange
  const suggested = suggestTranspose(key, transpose, singerRange)
  const suggestedKey = key && suggested !== null ? NOTE_NAMES[(((key.tonic + suggested) % 12) + 12) % 12] + (key.mode === 'minor' ? 'm' : '') : null

  return (
    <div className="scrim" ref={scrimRef} onClick={onClose}>
      <aside ref={drawerRef} className="drawer" role="dialog" aria-modal="true" aria-labelledby="song-drawer-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <div>
            <span className="eyebrow">{target.mode === 'add' ? `Add to ${target.sessionName}` : `In ${target.sessionName}`}</span>
            <h2 id="song-drawer-title">{target.mode === 'add' ? (phase === 'search' ? 'Find a song' : 'Song details') : 'Edit song'}</h2>
          </div>
          <button className="icon-btn icon-btn--lg" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form id="song-form" ref={bodyRef} className="drawer__body" onSubmit={onSubmit}>
          {phase === 'search' && (
            <>
              <div className="search">
                <b>YT</b>
                <input id="song-query" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search YouTube or paste a link" aria-label="Search YouTube or paste a link"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSearch() } }} />
                <button type="button" className="pill pill--dark" onClick={onSearch} disabled={!query.trim()}>
                  {parseYouTubeId(query) ? 'Use link' : 'Search'}
                </button>
              </div>
              {status && <p className="status" role="status">{status}</p>}
              {results.length > 0 && (
                <div className="results">
                  <span className="eyebrow">YouTube results</span>
                  {results.map((r) => (
                    <button type="button" key={r.youtubeId} className="result" onClick={() => pick(r)}>
                      <div className="result__thumb"><img src={thumbUrl(r.youtubeId)} alt="" />{r.durationSec ? <span>{toClock(r.durationSec)}</span> : null}</div>
                      <div><b>{r.title}</b><small>{r.channel}</small></div>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="pill pill--ghost" style={{ alignSelf: 'flex-start' }}
                onClick={() => { if (!title && query && !parseYouTubeId(query)) setTitle(query); setStatus(null); setPhase('details') }}>
                Enter details by hand instead
              </button>
            </>
          )}

          {phase === 'details' && (
            <>
              <div className="picked">
                {youtubeId ? <img src={thumbUrl(youtubeId)} alt="" /> : <span className="ph" />}
                <div>
                  <b>{youtubeId ? (title || 'Linked video') : 'No YouTube link'}</b>
                  <span className="muted">{youtubeId ? [channel, duration].filter(Boolean).join(' · ') || youtubeId : 'Band members won’t have a video to listen to'}</span>
                </div>
                <button type="button" className="pill" onClick={() => { setQuery(''); setPhase('search') }}>{youtubeId ? 'Change' : 'Add link'}</button>
              </div>

              <div className="grid-2">
                <label className="field"><span className="eyebrow">Title</span>
                  <input id="song-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
                <label className="field"><span className="eyebrow">Original artist</span>
                  <input id="song-artist" value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
              </div>

              <label className="field"><span className="eyebrow">Short name for Stage view (optional)</span>
                <input id="song-short-title" value={shortTitle} onChange={(e) => setShortTitle(e.target.value)}
                  placeholder={title || 'Shown big on stage — leave blank to use the full title'} />
              </label>

              <div className="field">
                <span className="eyebrow">Singer</span>
                <div className="singers">
                  {[...singers, null].map((m) => {
                    const b = singerBadge(members, m?.id ?? null)
                    return (
                      <button type="button" key={m?.id ?? 'none'} className="singer-opt" aria-pressed={(m?.id ?? null) === singerId}
                        onClick={() => setSingerId(m?.id ?? null)}>
                        <span className="avatar avatar--lg" style={{ background: b.color }}>{b.initial}</span>{m ? b.name : 'None'}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="tempo">
                <div className="field">
                  <span className="eyebrow">Tempo</span>
                  <label className="tempo__value">
                    <input id="song-bpm" type="number" min={30} max={300} value={bpm} placeholder="– –" aria-label="BPM"
                      onChange={(e) => { setBpm(e.target.value); setBpmSource('manual') }} />
                    <span className="mono muted">BPM</span>
                  </label>
                  {bpm && bpmSource ? <span className="tag" style={{ alignSelf: 'flex-start' }}>{SOURCE_LABEL[bpmSource]}</span>
                    : <p>Look it up, or play the video and tap along to the beat.</p>}
                  <button type="button" className="pill" style={{ alignSelf: 'flex-start' }} onClick={onLookupBpm}>Look up BPM &amp; key</button>
                  <a className="muted" style={{ fontSize: 11 }} href="https://getsongbpm.com" target="_blank" rel="noreferrer">
                    BPM &amp; key data via GetSongBPM.com
                  </a>
                </div>
                <button type="button" ref={tapRef} className="tap" onClick={onTap} aria-label="Tap tempo">
                  <b>Tap</b><span>{taps.length < 2 ? 'TAP THE BEAT' : `${taps.length} TAPS · ${tapBpm}`}</span>
                </button>
              </div>

              {matches.length > 0 && (
                <div className="results">
                  <span className="eyebrow">GetSongBPM matches</span>
                  {matches.map((m, i) => (
                    <button type="button" key={i} className="menu__item" onClick={() => applyMatch(m)}>
                      <b>{m.title} — {m.artist}</b><span className="mono">{m.bpm ?? '?'} bpm · {m.key ?? 'key ?'}</span>
                    </button>
                  ))}
                </div>
              )}
              {status && <p className="status" role="status">{status}</p>}

              <div className="grid-2">
                <label className="field"><span className="eyebrow">Key</span>
                  <select id="song-key" value={keyValue} onChange={(e) => setKeyValue(e.target.value)}>
                    <option value="">Not set</option>
                    {KEY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select></label>
                <div className="field"><span className="eyebrow">Transpose {playedKey && transpose !== 0 ? `→ ${NOTE_NAMES[playedKey.tonic]}${playedKey.mode === 'minor' ? 'm' : ''}` : ''}</span>
                  <div className="stepper">
                    <button type="button" aria-label="Transpose down" onClick={() => setTranspose((t) => Math.max(-11, t - 1))}>−</button>
                    <span>{transpose > 0 ? `+${transpose}` : transpose}</span>
                    <button type="button" aria-label="Transpose up" onClick={() => setTranspose((t) => Math.min(11, t + 1))}>+</button>
                  </div>
                  {suggested !== null && (
                    <button type="button" className="pill" onClick={() => setTranspose(suggested)}>
                      Suggest {suggested > 0 ? `+${suggested}` : suggested} ({suggestedKey}) for this singer
                    </button>
                  )}
                </div>
              </div>

              <div className="grid-2">
                <label className="field"><span className="eyebrow">Length (m:ss)</span>
                  <input id="song-duration" className="mono" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="4:05" inputMode="numeric" /></label>
              </div>

              <label className="field"><span className="eyebrow">Notes</span>
                <textarea id="song-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Intro cue, count-in, who starts…" /></label>

              <label className="field"><span className="eyebrow">Chord sheet (optional)</span>
                <textarea id="song-chords" className="mono" rows={6} value={chordSheet} onChange={(e) => setChordSheet(e.target.value)}
                  placeholder={'Chords on their own line above the lyrics, e.g.\nG           D\nAmazing grace how sweet'} />
              </label>
            </>
          )}
        </form>

        {phase === 'details' && (
          <footer className="drawer__foot">
            {target.mode === 'add' && <button type="button" className="pill pill--lg" onClick={() => setPhase('search')}>Back</button>}
            {target.mode === 'edit' && (confirmRemove ? (
              <span className="confirm">
                Remove from this show?
                <button type="button" className="pill pill--danger" onClick={() => {
                  dispatch({ type: 'removeItem', itemId: target.item.id })
                  notify(`Removed “${target.song.title}”`)
                  onClose()
                }}>Remove</button>
                <button type="button" className="pill pill--ghost" onClick={() => setConfirmRemove(false)}>Keep</button>
              </span>
            ) : (
              <button type="button" className="pill pill--ghost pill--lg" onClick={() => setConfirmRemove(true)}>Remove</button>
            ))}
            <span className="grow" />
            <button type="submit" form="song-form" className="pill pill--accent pill--lg">
              {target.mode === 'add' ? `Add to ${target.sessionName}` : 'Save changes'}
            </button>
          </footer>
        )}
      </aside>
    </div>
  )
}
