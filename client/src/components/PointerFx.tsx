import { gsap } from 'gsap'
import { useEffect, useRef, type RefObject } from 'react'

/**
 * Cursor follower (dot + ring) plus tilt-and-spotlight on every element matching `cards`.
 * Fine pointers only, and skipped when the visitor prefers reduced motion.
 */
export function PointerFx({ root, cards }: { root: RefObject<HTMLElement | null>; cards: string }) {
  const pickRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    const pick = pickRef.current
    if (!el || !pick) return
    if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // A guitar pick that follows the pointer (tip on the pointer), leans into fast moves and grows over links.
    el.classList.add('has-pick')
    gsap.set(pick, { xPercent: -50, yPercent: -92, opacity: 0, transformOrigin: '50% 92%' })
    const px = gsap.quickTo(pick, 'x', { duration: 0.12, ease: 'power3' }), py = gsap.quickTo(pick, 'y', { duration: 0.12, ease: 'power3' })
    const rot = gsap.quickTo(pick, 'rotation', { duration: 0.35, ease: 'power3' })
    let lastX = 0
    const onMove = (e: PointerEvent) => {
      const t = e.target as Element
      const typing = !!t.closest?.('input, textarea, select')
      px(e.clientX); py(e.clientY)
      rot(Math.max(-28, Math.min(28, (e.clientX - lastX) * 1.2)))
      lastX = e.clientX
      const hot = !!t.closest?.('a, button')
      const card = !!t.closest?.('.tilt')
      gsap.to(pick, { opacity: typing ? 0 : 1, scale: hot ? 1.5 : card ? 1.2 : 1, duration: 0.25, overwrite: 'auto' })
      pick.classList.toggle('is-hot', hot)
    }
    const onLeaveWin = () => gsap.to(pick, { opacity: 0, duration: 0.2 })

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
      el.classList.remove('has-pick')
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
    <div ref={pickRef} className="cursor-pick" aria-hidden>
      <svg width="30" height="34" viewBox="0 0 30 34">
        <path d="M15 2.5C23 2.5 27.5 11 25.5 19.5 23.8 27 18.5 31.5 15 31.5S6.2 27 4.5 19.5C2.5 11 7 2.5 15 2.5Z" />
      </svg>
    </div>
  )
}
