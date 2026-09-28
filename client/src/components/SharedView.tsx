import { useEffect, useMemo, useState } from 'react'
import { buildExport, formatShowDate, pdfFileName } from '../lib/exportData'
import { supabase } from '../lib/supabase'
import type { Member, Show, Song } from '../lib/types'

interface Shared {
  bandName: string
  show: Show
  songs: Record<string, Song>
  members: { id: string; name: string; isSinger: boolean }[]
}

const REFRESH_MS = 20_000

export function SharedView({ token }: { token: string }) {
  const [shared, setShared] = useState<Shared | null | undefined>(undefined)
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

  const data = useMemo(() => {
    if (!shared) return null
    const members: Member[] = shared.members.map((m) => ({ ...m, role: 'viewer' }))
    return buildExport(shared.show, shared.songs, members, shared.bandName)
  }, [shared])

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
