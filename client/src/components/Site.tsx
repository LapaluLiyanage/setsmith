import { gsap } from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import Contact from './Contact'
import Landing from './Landing'
import { startSmoothScroll } from '../lib/smoothScroll'
import './transition.css'

type Page = 'home' | 'contact'

const pageFor = (path: string): Page => (/^\/contact\/?$/.test(path) ? 'contact' : 'home')

/** Floating button that appears after scrolling down; its ring fills as you read down the page. */
function BackToTop() {
  const [show, setShow] = useState(false)
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setShow(window.scrollY > 500)
      setPct(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <button type="button" className={'back-top' + (show ? ' is-on' : '')} aria-label="Back to top" tabIndex={show ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}>
      <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden>
        <circle cx="24" cy="24" r="21" className="back-top__track" />
        <circle cx="24" cy="24" r="21" className="back-top__bar" strokeDasharray={131.95} strokeDashoffset={131.95 * (1 - pct)} />
        <path d="M24 31V17M17 23.5 24 16.5l7 7" className="back-top__arrow" />
      </svg>
    </button>
  )
}

/**
 * Public pages (landing + contact) with client-side navigation: links between them play a curtain wipe
 * instead of a hard reload. A link into the app (/app) wipes the screen and then loads it normally.
 */
export default function Site() {
  const [path, setPath] = useState(() => window.location.pathname)
  const curtain = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches

  const go = useCallback((href: string, hard: boolean) => {
    const c = curtain.current
    if (busy.current) return
    const url = new URL(href, window.location.href)
    const swap = () => {
      if (hard) { window.location.assign(url.href); return }
      window.history.pushState(null, '', url.pathname + url.search)
      setPath(url.pathname)
      window.scrollTo(0, 0)
    }
    if (!c || reduce()) { swap(); return }
    busy.current = true
    const tl = gsap.timeline({ onComplete: () => { busy.current = false } })
    tl.set(c, { display: 'grid', yPercent: 100 })
      .to(c, { yPercent: 0, duration: 0.5, ease: 'power3.inOut' })
      .call(swap)
    if (!hard) tl.to(c, { yPercent: -100, duration: 0.55, ease: 'power3.inOut', delay: 0.12 }).set(c, { display: 'none' })
  }, [])

  useEffect(() => startSmoothScroll(), [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const isApp = /^\/app(\/|$)/.test(url.pathname)
      const isSite = url.pathname === '/' || /^\/contact\/?$/.test(url.pathname)
      if (!isApp && !isSite) return
      if (!isApp && url.pathname === window.location.pathname && url.hash) return // in-page anchor
      if (!isApp && url.pathname === window.location.pathname) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      e.preventDefault()
      go(url.pathname + url.search + url.hash, isApp)
    }
    const onPop = () => { setPath(window.location.pathname); window.scrollTo(0, 0) }
    document.addEventListener('click', onClick)
    window.addEventListener('popstate', onPop)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPop)
    }
  }, [go])

  const page = pageFor(path)
  return (
    <>
      {page === 'contact' ? <Contact key="contact" /> : <Landing key="home" />}
      <BackToTop />
      <div ref={curtain} className="curtain" aria-hidden>
        <svg width="56" height="56" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#e2f24a" /><g fill="#1d1f22" transform="translate(3,3)"><rect x="13" y="1" width="2" height="11" /><ellipse cx="11.5" cy="11" rx="3.5" ry="3" /><path d="M0 15h26l-4.2 6H4.2z" /><rect x="8" y="21" width="10" height="5" /></g></svg>
      </div>
    </>
  )
}
