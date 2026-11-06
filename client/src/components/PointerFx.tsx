import { gsap } from 'gsap'
import { useEffect, useRef, type RefObject } from 'react'

/**
 * Music-note cursor plus tilt-and-spotlight on every element matching `cards`.
 * Fine pointers only, and skipped when the visitor prefers reduced motion.
 */
export function PointerFx({ root, cards }: { root: RefObject<HTMLElement | null>; cards: string }) {
  const pickRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    const pick = pickRef.current
    if (!el || !pick) return
    if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // A music note that follows the pointer (note head on the pointer), leans into fast moves, grows over links,
    // drops little notes as you move and bursts a few on click.
    el.classList.add('has-pick')
    gsap.set(pick, { xPercent: -43, yPercent: -70, opacity: 0, transformOrigin: '43% 70%' })
    const px = gsap.quickTo(pick, 'x', { duration: 0.12, ease: 'power3' }), py = gsap.quickTo(pick, 'y', { duration: 0.12, ease: 'power3' })
    const rot = gsap.quickTo(pick, 'rotation', { duration: 0.35, ease: 'power3' })
    let lastX = 0, lastY = 0, lastDrop = 0
    const NOTES = ['♪', '♫', '♩', '♬']
    const drop = (x: number, y: number, count = 1, spread = 0) => {
      for (let i = 0; i < count; i++) {
        const n = document.createElement('span')
        n.className = 'cursor-note'
        n.textContent = NOTES[Math.floor(Math.random() * NOTES.length)]
        el.appendChild(n)
        const dx = (Math.random() - 0.5) * spread
        gsap.fromTo(n, { x: x + (Math.random() - 0.5) * 10, y, opacity: 0.9, scale: 0.6, rotation: (Math.random() - 0.5) * 30 },
          { x: x + dx, y: y - 50 - Math.random() * 40, opacity: 0, scale: 1.1, rotation: (Math.random() - 0.5) * 60, duration: 0.9 + Math.random() * 0.4, ease: 'power2.out', onComplete: () => n.remove() })
      }
    }
    const onDown = (e: PointerEvent) => { if (!(e.target as Element).closest?.('input, textarea, select')) drop(e.clientX, e.clientY, 4, 90) }
    const onMove = (e: PointerEvent) => {
      const t = e.target as Element
      const typing = !!t.closest?.('input, textarea, select')
      px(e.clientX); py(e.clientY)
      rot(Math.max(-28, Math.min(28, (e.clientX - lastX) * 1.2)))
      const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY)
      lastX = e.clientX; lastY = e.clientY
      const now = performance.now()
      if (!typing && speed > 14 && now - lastDrop > 110) { lastDrop = now; drop(e.clientX, e.clientY - 8) }
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
    window.addEventListener('pointerdown', onDown)
    document.documentElement.addEventListener('pointerleave', onLeaveWin)
    return () => {
      el.classList.remove('has-pick')
      window.clearTimeout(later)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      el.querySelectorAll('.cursor-note').forEach((n) => n.remove())
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
      <svg width="28" height="34" viewBox="0 0 28 34">
        <path d="M18 3 C22 8 27 9 26 17 C24 13 21 13 18 12 Z" />
        <rect x="16" y="3" width="3" height="21" rx="1.5" />
        <ellipse cx="12" cy="24" rx="6.5" ry="4.8" transform="rotate(-20 12 24)" />
      </svg>
    </div>
  )
}
