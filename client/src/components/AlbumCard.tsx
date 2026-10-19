import { useEffect, useRef, useState } from 'react'
import { deleteShowPhotoFile, signedPhotoUrls, uploadShowPhoto } from '../lib/showPhotos'
import type { CSSProperties } from 'react'
import type { Show } from '../lib/types'
import { useStore } from '../state/store'

/** Photo album for a show that has already happened. Everyone in the band can look; editors add and delete. */
export function AlbumCard({ show, bandId }: { show: Show; bandId: string }) {
  const { dispatch, cloud } = useStore()
  const photos = show.photos ?? []
  const canEdit = !cloud.readOnly
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<number | null>(null)
  const [ratios, setRatios] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const pathKey = photos.map((p) => p.path).join('|')

  useEffect(() => {
    let cancelled = false
    signedPhotoUrls(photos.map((p) => p.path)).then((next) => { if (!cancelled) setUrls(next) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey])

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      else if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : Math.min(photos.length - 1, i + 1)))
      else if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : Math.max(0, i - 1)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, photos.length])

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setErrors([])
    const list = Array.from(files)
    setBusy((b) => b + list.length)
    await Promise.all(list.map(async (file) => {
      try {
        const photo = await uploadShowPhoto(bandId, show.id, file)
        dispatch({ type: 'addShowPhotos', showId: show.id, photos: [photo] })
      } catch (e) {
        setErrors((prev) => [...prev, e instanceof Error ? e.message : `Couldn't add ${file.name}`])
      } finally {
        setBusy((b) => b - 1)
      }
    }))
    if (fileRef.current) fileRef.current.value = ''
  }

  function remove(id: string, path: string) {
    dispatch({ type: 'removeShowPhoto', showId: show.id, photoId: id })
    deleteShowPhotoFile(path)
    setOpen(null)
  }

  const current = open !== null ? photos[open] : null

  return (
    <section className="card album" aria-label="Photo album">
      <div className="album__head">
        <div>
          <span className="eyebrow">Photo album</span>
          <h3>{photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'No photos yet'}</h3>
        </div>
        {canEdit && (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            <button type="button" className="pill pill--dark" disabled={busy > 0} onClick={() => fileRef.current?.click()}>
              {busy > 0 ? `Adding ${busy}…` : '+ Add photos'}
            </button>
          </>
        )}
      </div>
      {errors.length > 0 && <p className="album__error" role="alert">{[...new Set(errors)].join(" · ")}</p>}
      {photos.length > 0 && (
        <div className="album__grid">
          {[...photos].reverse().map((p) => {
            const i = photos.indexOf(p)
            return (
              <button key={p.id} type="button" className="album__thumb" style={{ '--r': ratios[p.id] ?? 1.5 } as CSSProperties}
                aria-label={`Open photo ${i + 1}`} onClick={() => setOpen(i)}>
                {urls[p.path] ? (
                  <img src={urls[p.path]} alt="" loading="lazy"
                    onLoad={(e) => {
                      const { naturalWidth: w, naturalHeight: h } = e.currentTarget
                      if (w && h) setRatios((r) => (r[p.id] === w / h ? r : { ...r, [p.id]: w / h }))
                    }} />
                ) : <span />}
              </button>
            )
          })}
        </div>
      )}
      {photos.length === 0 && !canEdit && <p className="muted">Nobody has added photos from this show yet.</p>}

      {current && (
        <div className="album__lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setOpen(null)}>
          <div className="album__bar" onClick={(e) => e.stopPropagation()}>
            <span className="mono">{(open ?? 0) + 1} / {photos.length}</span>
            {canEdit && <button type="button" className="pill pill--danger" onClick={() => remove(current.id, current.path)}>Delete</button>}
            <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(null)}>✕</button>
          </div>
          {urls[current.path] && <img src={urls[current.path]} alt="" onClick={(e) => e.stopPropagation()} />}
          {(open ?? 0) > 0 && <button type="button" className="album__nav album__nav--prev" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); setOpen((i) => (i ?? 1) - 1) }}>‹</button>}
          {(open ?? 0) < photos.length - 1 && <button type="button" className="album__nav album__nav--next" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); setOpen((i) => (i ?? 0) + 1) }}>›</button>}
        </div>
      )}
    </section>
  )
}
