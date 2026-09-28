import { gsap } from 'gsap'
import { useLayoutEffect, type RefObject } from 'react'

export function reducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Slide a side drawer in from the right and fade its scrim, once on mount. */
export function useDrawerIn(drawer: RefObject<HTMLElement | null>, scrim: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    if (reducedMotion()) return
    // fromTo + revert (not from): React dev mode runs effects twice, and a second from() would
    // capture the half-faded state as the end state.
    const ctx = gsap.context(() => {
      if (scrim.current) gsap.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' })
      if (drawer.current) gsap.fromTo(drawer.current, { xPercent: 12, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.4, ease: 'power3.out' })
    })
    return () => ctx.revert()
  }, [drawer, scrim])
}
