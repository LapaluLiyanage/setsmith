import { gsap } from 'gsap'
import { useEffect, useRef, type RefObject } from 'react'

/**
 * Cursor follower (dot + ring) plus tilt-and-spotlight on every element matching `cards`.
 * Fine pointers only, and skipped when the visitor prefers reduced motion.
 */
export function PointerFx({ root, cards }: { root: RefObject<HTMLElement | null>; cards: string }) {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    const dot = dotRef.current
    const ring = ringRef.current
    if (!el || !dot || !ring) return
    if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return

    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, opacity: 0 })
    const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' }), dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' })
    const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' })

    const onMove = (e: PointerEvent) => {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY)
      gsap.to([dot, ring], { opacity: 1, duration: 0.2, overwrite: 'auto' })
      const t = e.target as Element
      const hot = !!t.closest?.('a, button')
      const card = !!t.closest?.('.tilt')
      gsap.to(ring, { scale: hot ? 1.9 : card ? 1.35 : 1, duration: 0.25, overwrite: 'auto' })
      gsap.to(dot, { scale: hot ? 0.4 : 1, duration: 0.2, overwrite: 'auto' })
    }
    const onLeaveWin = () => gsap.to([dot, ring], { opacity: 0, duration: 0.2 })

    // Cards can mount a moment after this effect (page entrance animations), so bind to what exists now
    // and again shortly after.
    const bound = new Map<HTMLElement, { move: (e: PointerEvent) => void; leave: () => void }>()
    const bind = () => {
      el.querySelectorAll<HTMLElement>(cards).forEach((c) => {
        if (bound.has(c)) return
        c.classList.add('tilt')
        const move = (e: PointerEvent) => {
          const r = c.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
          c.style.setProperty('--mx', `${e.clientX - r.left}px`)
          c.style.setProperty('--my', `${e.clientY - r.top}px`)
          gsap.to(c, { rotationY: (px - 0.5) * 10, rotationX: (0.5 - py) * 10, y: -4, transformPerspective: 900, duration: 0.35, ease: 'power2.out', overwrite: 'auto' })
        }
        const leave = () => gsap.to(c, { rotationX: 0, rotationY: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.6)', overwrite: 'auto' })
        c.addEventListener('pointermove', move)
        c.addEventListener('pointerleave', leave)
        bound.set(c, { move, leave })
      })
    }
    bind()
    const later = window.setTimeout(bind, 600)

    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', onLeaveWin)
    return () => {
      window.clearTimeout(later)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeaveWin)
      bound.forEach(({ move, leave }, c) => {
        c.removeEventListener('pointermove', move)
        c.removeEventListener('pointerleave', leave)
        c.classList.remove('tilt')
        gsap.set(c, { clearProps: 'rotationX,rotationY,y,transformPerspective' })
      })
    }
  }, [root, cards])

  return (
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden />
      <div ref={dotRef} className="cursor-dot" aria-hidden />
    </>
  )
}
