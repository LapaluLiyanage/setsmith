import { useEffect, useRef, useState } from 'react'

/** Draws a PDF chord sheet page by page onto canvases (works the same on every phone, unlike an embedded viewer). */
export function PdfSheet({ url, zoom = 1 }: { url: string; zoom?: number }) {
  const holder = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let destroy: (() => void) | undefined
    setState('loading')
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        const task = pdfjs.getDocument({ url })
        destroy = () => { task.destroy() }
        const pdf = await task.promise
        const box = holder.current
        if (cancelled || !box) return
        box.replaceChildren()
        // Render at 1.5x the on-screen width (capped at 2x pixel density) so zooming in stays sharp.
        const target = Math.max(320, box.clientWidth) * Math.min(window.devicePixelRatio || 1, 2) * 1.5
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n)
          if (cancelled) return
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: target / base.width })
          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.className = 'pdfsheet__page'
          box.appendChild(canvas)
          await page.render({ canvas, viewport }).promise
        }
        if (!cancelled) setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true; destroy?.() }
  }, [url])

  return (
    <div className="pdfsheet">
      {state === 'loading' && <p className="muted">Loading PDF…</p>}
      {state === 'error' && <p className="muted">Could not show this PDF here. <a href={url} target="_blank" rel="noreferrer">Open it in a new tab</a>.</p>}
      <div ref={holder} className="pdfsheet__pages" style={zoom > 1 ? { width: `${zoom * 100}%` } : undefined} />
    </div>
  )
}
