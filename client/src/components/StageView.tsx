import { gsap } from 'gsap'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { reducedMotion } from '../lib/motion'
import { beatSeconds, buildStageList } from '../lib/stage'
import type { Show } from '../lib/types'
import { watchUrl } from '../lib/youtube'
import { useStore } from '../state/store'

const SWIPE_PX = 50

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Keep the phone screen on while the band is playing. Not every browser allows it; that's fine. */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
        lock = (await nav.wakeLock?.request('screen')) ?? null
      } catch {
        lock = null
      }
    }
    request()
    const onVisible = () => document.visibilityState === 'visible' && request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])
}

export function StageView({ show, onClose }: { show: Show; onClose: () => void }) {
  const { state } = useStore()
  const list = useMemo(() => buildStageList(show, state.songs, state.members), [show, state.songs, state.members])
  const [index, setIndex] = useState(0)
  const direction = useRef(1)
  const x0 = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLDivElement>(null)
  const beatRef = useRef<HTMLDivElement>(null)
  const clock = useClock()
  useWakeLock()

  const cur = list[Math.min(index, list.length - 1)]
  const next = list[index + 1]

  function go(step: number) {
    const i = Math.max(0, Math.min(list.length - 1, index + step))
    if (i === index) return
    direction.current = step
    setIndex(i)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Screen fades up when opened.
  useLayoutEffect(() => {
    if (reducedMotion() || !rootRef.current) return
    const ctx = gsap.context(() => gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }))
    return () => ctx.revert()
  }, [])

  // New song slides in from the side you swiped towards.
  useLayoutEffect(() => {
    if (reducedMotion() || !currentRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(currentRef.current, { x: direction.current * 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' })
    })
    return () => ctx.revert()
  }, [index])

  // The dot pulses on the beat of the current song.
  useLayoutEffect(() => {
    if (!beatRef.current || reducedMotion()) return
    const per = beatSeconds(cur?.bpm ?? null)
    const tween = gsap.fromTo(beatRef.current, { scale: 1.25, opacity: 1 },
      { scale: 0.7, opacity: 0.45, duration: per * 0.9, ease: 'power2.out', repeat: -1, repeatDelay: per * 0.1 })
    return () => { tween.kill() }
  }, [cur?.bpm, index])

  function onPointerDown(e: PointerEvent) { x0.current = e.clientX }
  function onPointerUp(e: PointerEvent) {
    if (x0.current == null) return
    const dx = e.clientX - x0.current
    x0.current = null
    if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1)
  }

  return (
    <div ref={rootRef} className="stage" role="dialog" aria-modal="true" aria-label="Stage view"
      onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <div className="stage__col">
        <header className="stage__head">
          <button className="stage__close" onClick={onClose} aria-label="Close stage view">×</button>
          <div className="stage__where">
            <span>{cur ? `${cur.sessionName.toUpperCase()} SESSION` : show.name}</span>
            <b>{cur ? `Song ${cur.inSession} of ${cur.sessionSize} · ${cur.number}/${list.length} tonight` : 'No songs yet'}</b>
          </div>
          <span className="stage__clock">{clock}</span>
        </header>

        <div className="stage__bars" aria-hidden>
          {list.map((s, j) => <i key={s.itemId} className={j < index ? 'done' : j === index ? 'now' : ''} />)}
        </div>

        {cur ? (
          <div ref={currentRef} className="stage__now" aria-live="polite">
            <div className="stage__beat"><span className="stage__dot-wrap"><i ref={beatRef} /></span>NOW · {String(cur.number).padStart(2, '0')}</div>
            <h1>{cur.title}</h1>
            <span className="stage__artist">{[cur.artist, cur.transposeNote].filter(Boolean).join(' · ')}</span>
            <div className="stage__grid">
              <div className="stage__card stage__card--wide">
                <span className="stage__avatar" style={{ background: cur.singer.color }}>{cur.singer.initial}</span>
                <div><span className="stage__label">SINGER</span><b className="stage__big">{cur.singer.name}</b></div>
              </div>
              <div className="stage__card">
                <span className="stage__label">KEY</span>
                <b className="stage__big">{cur.key ? cur.key.replace(' major', '').replace(' minor', 'm') : '—'}</b>
                <span className="stage__accent">{cur.camelot ? `Camelot ${cur.camelot}` : 'key not set'}</span>
              </div>
              <div className="stage__card stage__card--bpm">
                <span className="stage__label">BPM</span>
                <b className="stage__bpm">{cur.bpm ?? '—'}</b>
                <span>{cur.duration}</span>
              </div>
              {cur.notes && <div className="stage__card stage__card--wide stage__notes">{cur.notes}</div>}
            </div>
            {cur.youtubeId && (
              <a className="stage__yt" href={watchUrl(cur.youtubeId)} target="_blank" rel="noreferrer"
                onPointerDown={(e) => e.stopPropagation()}>▶ Listen on YouTube</a>
            )}
          </div>
        ) : (
          <div className="stage__now"><h1>Add songs to the setlist first.</h1></div>
        )}

        <footer className="stage__foot">
          {next ? (
            <button className="stage__next" onClick={() => go(1)} onPointerDown={(e) => e.stopPropagation()}>
              <div>
                <span className="stage__label">NEXT · {String(next.number).padStart(2, '0')}{next.sessionName !== cur?.sessionName ? ` · ${next.sessionName.toUpperCase()}` : ''}</span>
                <b>{next.title}</b>
                <span className="stage__meta">{[next.singer.name, next.key?.replace(' major', '').replace(' minor', 'm'), next.bpm && `${next.bpm} bpm`].filter(Boolean).join(' · ')}</span>
              </div>
              <i>→</i>
            </button>
          ) : cur ? (
            <div className="stage__last">Last song of the night — thank you{show.venue ? `, ${show.venue}` : ''}.</div>
          ) : null}
          <div className="stage__nav">
            <button onClick={() => go(-1)} disabled={index === 0} onPointerDown={(e) => e.stopPropagation()}>← PREV</button>
            <span>SWIPE LEFT TO ADVANCE</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
