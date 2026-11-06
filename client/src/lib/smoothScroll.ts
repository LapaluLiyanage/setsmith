import { gsap } from 'gsap'

/**
 * Inertial mouse-wheel scrolling for the public pages. Wheel input moves a target position and the page eases
 * toward it every frame; keyboard, scrollbar dragging, anchors and touch keep using the browser's own scrolling
 * (the target just re-syncs to wherever the page ended up). Returns a cleanup function.
 */
export function startSmoothScroll(): () => void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  let target = window.scrollY
  let current = window.scrollY
  let lastSet = window.scrollY
  let running = false

  const max = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)

  const tick = () => {
    const dt = Math.min(gsap.ticker.deltaRatio(60) / 60, 0.1)
    current += (target - current) * (1 - Math.exp(-dt * 9))
    if (Math.abs(target - current) < 0.4) current = target
    lastSet = current
    window.scrollTo(0, current)
    if (current === target) stop()
  }
  const start = () => { if (!running) { running = true; gsap.ticker.add(tick) } }
  const stop = () => { if (running) { running = false; gsap.ticker.remove(tick) } }

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.defaultPrevented) return
    const el = e.target as Element
    if (el.closest?.('textarea, select, [data-native-scroll]')) return
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
    if (!running) { current = target = window.scrollY }
    target = Math.min(max(), Math.max(0, target + e.deltaY * unit))
    e.preventDefault()
    start()
  }

  const onScroll = () => {
    if (Math.abs(window.scrollY - lastSet) < 2) return // our own movement
    stop()
    current = target = lastSet = window.scrollY // the browser moved the page (keys, scrollbar, anchor, route change)
  }

  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    stop()
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('scroll', onScroll)
  }
}
