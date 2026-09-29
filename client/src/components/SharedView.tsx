import { useEffect, useMemo, useState } from 'react'
import { buildExport, formatShowDate, pdfFileName } from '../lib/exportData'
import { buildStageList } from '../lib/stage'
import { supabase } from '../lib/supabase'
import type { Member, Show, Song } from '../lib/types'
import { SongPlayer } from './SongPlayer'

interface Shared {
  bandId: string
  bandName: string
  show: Show
  songs: Record<string, Song>
  members: { id: string; name: string; isSinger: boolean }[]
}

interface NowPlaying { showId: string; itemId: string }

const REFRESH_MS = 20_000

export function SharedView({ token }: { token: string }) {
  const [shared, setShared] = useState<Shared | null | undefined>(undefined)
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [showChords, setShowChords] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return setShared(null)
    const client = supabase
    let cancelled = false
    const pull = () =>
      client.rpc('get_shared', { p_token: token }).then(({ data, error }) => {
        if (cancelled) return
        if (error) setShared((prev) => prev ?? null)
        else setShared(data as Shared | null)
      })
    pull()
    const id = setInterval(pull, REFRESH_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [token])

  // No account needed: the public link also follows the live "now playing" pointer.
  const bandId = shared?.bandId
  useEffect(() => {
    if (!supabase || !bandId) return
    const client = supabase
    client.from('now_playing').select('show_id, item_id').eq('band_id', bandId).maybeSingle()
      .then(({ data }) => setNowPlaying(data ? { showId: data.show_id as string, itemId: data.item_id as string } : null))
    const channel = client
      .channel(`shared:${bandId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'now_playing', filter: `band_id=eq.${bandId}` }, (payload) => {
        const row = payload.new as { show_id?: string; item_id?: string } | undefined
        if (row?.show_id && row?.item_id) setNowPlaying({ showId: row.show_id, itemId: row.item_id })
      })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [bandId])

  const members: Member[] = useMemo(() => (shared?.members ?? []).map((m) => ({ ...m, role: 'viewer' })), [shared])

  const data = useMemo(() => {
    if (!shared) return null
    return buildExport(shared.show, shared.songs, members, shared.bandName)
  }, [shared, members])

  const stageList = useMemo(
    () => (shared ? buildStageList(shared.show, shared.songs, members) : []),
    [shared, members],
  )
  const current = nowPlaying?.showId === shared?.show.id
    ? stageList.find((s) => s.itemId === nowPlaying?.itemId)
    : undefined

  useEffect(() => { setShowChords(false) }, [current?.itemId])

  async function download() {
    if (!data) return
    setBusy(true)
    try {
      const { renderSetlistPdf } = await import('../pdf/renderPdf')
      const blob = await renderSetlistPdf(data)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfFileName(data)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } finally {
      setBusy(false)
    }
  }

  if (shared === undefined) return <div className="gate"><p className="muted" role="status">Loading setlist…</p></div>
  if (!data) {
    return (
      <div className="gate">
        <div className="gate__card">
          <span className="eyebrow">Setsmith</span>
          <h1>Link not available</h1>
          <p className="muted">This setlist link was turned off or never existed. Ask the band for a new one.</p>
        </div>
      </div>
    )
  }

  return (
    <main className="shared">
      <header>
        <span className="eyebrow">{data.bandName} · read-only</span>
        <h1>{data.showName}</h1>
        <p className="muted">{formatShowDate(data.date)}{data.venue ? ` · ${data.venue}` : ''} · {data.songCount} songs · {data.planned}</p>
      </header>
      {current && (
        <section className="shared__live">
          <span className="eyebrow">● NOW PLAYING</span>
          <h2>{current.stageTitle}</h2>
          <p className="muted">{[current.artist, current.singer.name, current.key, current.bpm && `${current.bpm} bpm`].filter(Boolean).join(' · ')}</p>
          <div className="shared__actions">
            {current.chordSheet && (
              <button type="button" className="pill" aria-pressed={showChords} onClick={() => setShowChords((v) => !v)}>
                {showChords ? 'Hide chords' : 'Chords'}
              </button>
            )}
          </div>
          {showChords && current.chordSheet && <pre className="shared__chords">{current.chordSheet}</pre>}
          {current.youtubeId && <SongPlayer youtubeId={current.youtubeId} title={current.youtubeId2 ? `${current.title} — song 1` : current.title} artist={current.artist} />}
          {current.youtubeId2 && <SongPlayer youtubeId={current.youtubeId2} title={`${current.title} — song 2`} artist={current.artist} />}
        </section>
      )}

      <div className="shared__actions">
        <button className="pill pill--accent" onClick={download} disabled={busy}>{busy ? 'Building PDF…' : 'Download PDF'}</button>
      </div>
      {data.sessions.map((s) => (
        <section className="shared__session" key={s.name}>
          <h2>{s.name} · {s.total}</h2>
          {s.rows.map((r) => (
            <div className="shared__row" key={r.number}>
              <span className="shared__meta">{r.number}</span>
              <div>
                <b>{r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : r.title}</b>
                <div className="muted">{r.artist}{r.singer ? ` · ${r.singer}` : ''}{r.notes ? ` · ${r.notes}` : ''}</div>
              </div>
              <span className="shared__meta">{r.bpm} BPM · {r.key}</span>
            </div>
          ))}
        </section>
      ))}
    </main>
  )
}
