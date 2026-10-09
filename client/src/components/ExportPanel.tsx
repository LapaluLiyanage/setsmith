import { useEffect, useMemo, useRef, useState } from 'react'
import { buildExport, chordPdfFileName, pdfFileName, toShareText } from '../lib/exportData'
import { buildStageList } from '../lib/stage'
import type { Show } from '../lib/types'
import { useDrawerIn } from '../lib/motion'
import { useStore } from '../state/store'

type Status = { kind: 'working' } | { kind: 'ready'; blob: Blob; url: string } | { kind: 'error'; message: string }

export function ExportPanel({ show, onClose }: { show: Show; onClose: () => void }) {
  const { state } = useStore()
  const drawerRef = useRef<HTMLElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  useDrawerIn(drawerRef, scrimRef)
  const data = useMemo(() => buildExport(show, state.songs, state.members, state.bandName), [show, state.songs, state.members, state.bandName])
  const [mode, setMode] = useState<'list' | 'chords'>('list')
  const chordSongs = useMemo(
    () => buildStageList(show, state.songs, state.members).filter((s) => s.chordSheet || s.chordSheetImage),
    [show, state.songs, state.members],
  )
  const [status, setStatus] = useState<Status>({ kind: 'working' })
  const [note, setNote] = useState<string | null>(null)
  const fileName = mode === 'chords' ? chordPdfFileName(data) : pdfFileName(data)
  const shareText = toShareText(data)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    setStatus({ kind: 'working' })
    import('../pdf/renderPdf')
      .then(({ renderSetlistPdf, renderChordSheetsPdf }) => (mode === 'chords'
        ? renderChordSheetsPdf(chordSongs, data.bandName, data.showName)
        : renderSetlistPdf(data)))
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setStatus({ kind: 'ready', blob, url })
      })
      .catch((err: Error) => !cancelled && setStatus({ kind: 'error', message: err.message }))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [data, mode, chordSongs])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const rows = data.sessions.flatMap((s) => s.rows)
  const missing = {
    link: rows.filter((r) => !r.url).length,
    bpm: rows.filter((r) => !r.bpm).length,
    key: rows.filter((r) => !r.key).length,
    singer: rows.filter((r) => !r.singer).length,
  }
  const gaps = Object.entries(missing).filter(([, n]) => n > 0)

  const pdfFile = status.kind === 'ready' ? new File([status.blob], fileName, { type: 'application/pdf' }) : null
  const canShareFile = !!pdfFile && typeof navigator.canShare === 'function' && navigator.canShare({ files: [pdfFile] })

  function download() {
    if (status.kind !== 'ready') return
    const a = document.createElement('a')
    a.href = status.url
    a.download = fileName
    a.click()
    setNote(`Saved ${fileName}.`)
  }

  async function sharePdf() {
    if (!pdfFile) return
    try {
      await navigator.share({ files: [pdfFile], title: data.showName, text: `${data.showName} setlist` })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setNote('Sharing didn’t work here. Download the PDF and send it instead.')
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(shareText)
      setNote('Setlist copied. Paste it into WhatsApp or an email.')
    } catch {
      setNote('Couldn’t copy automatically. Select the text below and copy it.')
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent(`Setlist: ${data.showName}`)}&body=${encodeURIComponent(`${shareText}\n\n(PDF attached)`)}`

  return (
    <div className="scrim" ref={scrimRef} onClick={onClose}>
      <aside ref={drawerRef} className="drawer drawer--wide" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <div><span className="eyebrow">Export</span><h2 id="export-title">Send setlist</h2></div>
          <button className="icon-btn icon-btn--lg" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="drawer__body">
          {gaps.length > 0 && (
            <p className="status">
              Before sending: {gaps.map(([what, n]) => `${n} song${n > 1 ? 's' : ''} without ${what === 'link' ? 'a YouTube link' : what === 'bpm' ? 'BPM' : `a ${what}`}`).join(', ')}.
            </p>
          )}

          <div className="export-actions" role="group" aria-label="What to export">
            <button className={'pill' + (mode === 'list' ? ' pill--accent' : '')} aria-pressed={mode === 'list'} onClick={() => setMode('list')}>Song list</button>
            <button className={'pill' + (mode === 'chords' ? ' pill--accent' : '')} aria-pressed={mode === 'chords'}
              disabled={chordSongs.length === 0} onClick={() => setMode('chords')}
              title={chordSongs.length === 0 ? 'None of the songs in this show have a chord sheet yet' : undefined}>
              Chord sheets ({chordSongs.length})
            </button>
          </div>

          <div className="export-actions">
            <button className="pill pill--accent" onClick={download} disabled={status.kind !== 'ready'}>{mode === 'chords' ? 'Download chord sheets PDF' : 'Download PDF'}</button>
            {canShareFile && <button className="pill" onClick={sharePdf}>Share PDF (WhatsApp, etc.)</button>}
            <a className="pill" href={mailto}>Email</a>
            <button className="pill" onClick={copyText}>Copy as text</button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Email opens your mail app with the setlist in the message; attach the downloaded PDF before sending.
          </p>
          {note && <p className="status" role="status">{note}</p>}

          <div className="pdf-preview">
            {status.kind === 'working' && <p className="muted">Building the PDF…</p>}
            {status.kind === 'error' && <p className="status">Couldn’t build the PDF: {status.message}</p>}
            {status.kind === 'ready' && <iframe title="PDF preview" src={status.url} />}
          </div>

          <details>
            <summary>Text version</summary>
            <textarea id="share-text" readOnly rows={12} value={shareText} onFocus={(e) => e.target.select()} />
          </details>
        </div>
      </aside>
    </div>
  )
}
