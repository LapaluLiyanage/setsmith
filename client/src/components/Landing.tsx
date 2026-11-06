import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../state/theme'
import './landing.css'

const TECH = ['React', 'TypeScript', 'Vite', 'dnd-kit', 'GSAP', 'Three.js', 'Supabase', 'Express', 'Capacitor', 'React-PDF', 'GetSongBPM', 'YouTube Data API']

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function hasSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (/^sb-.*-auth-token$/.test(localStorage.key(i) ?? '')) return true
    }
  } catch {
    // Storage blocked: treat as signed out.
  }
  return false
}

function PulseDot() {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ac)', boxShadow: '0 0 0 2px var(--tx)', animation: 'ssPulse .5s ease-in-out infinite', flex: 'none' }} />
}

function Sparkline() {
  const pts = [92, 98, 104, 110, 118, 112, 124, 128, 132, 126, 120, 108]
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 200} ${36 - (v - 88) * 0.75}`).join(' ')
  return (
    <svg viewBox="0 0 200 40" style={{ width: '100%', height: 36, overflow: 'visible' }}>
      <path d={d} fill="none" stroke="var(--tx)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" pathLength={1}
        style={{ strokeDasharray: 1, strokeDashoffset: 0, animation: 'ssDraw 1.6s ease both' }} />
      <circle cx={(200 * 8) / 11} cy={36 - (132 - 88) * 0.75} r={4} fill="var(--ac)" stroke="var(--tx)" strokeWidth={2} />
    </svg>
  )
}

/** Public landing page (ported from the Claude Design "Setsmith Landing" file). The app itself lives at /app. */
export default function Landing() {
  const [, toggleTheme] = useTheme()
  const [wide, setWide] = useState(() => window.innerWidth > 1060)
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null)
  const [signedIn] = useState(hasSession)
  const root = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth > 1060)
    const onBip = (e: Event) => { e.preventDefault(); setDeferred(e as InstallPromptEvent) }
    window.addEventListener('resize', onResize)
    window.addEventListener('beforeinstallprompt', onBip)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('beforeinstallprompt', onBip)
    }
  }, [])

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Setsmith — Setlist planner for live bands'
    return () => { document.title = prevTitle }
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const onAnchor = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a[href^="#"]')
      if (!a) return
      const id = a.getAttribute('href') ?? ''
      const target = id === '#top' ? null : el.querySelector(id)
      if (id !== '#top' && !target) return
      e.preventDefault()
      const top = target ? target.getBoundingClientRect().top + window.scrollY - 76 : 0
      window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
    }
    document.addEventListener('click', onAnchor)
    if (reduce) return () => document.removeEventListener('click', onAnchor)

    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      const q = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s))
      const ease = 'power3.out'
      const tl = gsap.timeline({ defaults: { ease } })
      const copy = q('[data-hero-copy] > *'), shot = q('[data-hero-visual] > div:first-child'), phone = q('[data-hero-phone]')
      if (copy.length) tl.from(copy, { y: 28, opacity: 0, duration: 0.8, stagger: 0.08 })
      if (shot.length) tl.from(shot, { y: 60, opacity: 0, duration: 1.1 }, 0.15)
      if (phone.length) {
        tl.from(phone, { y: 90, opacity: 0, duration: 1.1 }, 0.35)
        gsap.to(phone, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: phone[0].closest('section'), start: 'top top', end: 'bottom top', scrub: true } })
      }
      q('main > section').filter((s) => s.dataset.screenLabel !== 'Hero').forEach((s) => {
        gsap.from(s, { y: 60, opacity: 0, duration: 1, ease, scrollTrigger: { trigger: s, start: 'top 90%', once: true } })
      })
      const stagger = (sel: string, opts?: gsap.TweenVars) => {
        const grid = el.querySelector(sel)
        if (!grid || !grid.children.length) return
        gsap.from(grid.children, { y: 36, opacity: 0, duration: 0.7, ease, stagger: 0.08, scrollTrigger: { trigger: grid, start: 'top 85%', once: true }, ...opts })
      }
      stagger('#features > div:last-child')
      stagger('#how > div:last-child', { stagger: 0.12 })
      stagger('#stage > div:first-child > div:last-child', { y: 0, x: -24, stagger: 0.1 })
      stagger('#chords > div:last-child > div:last-child', { y: 0, x: -24, stagger: 0.1 })
      const ph = el.querySelector('#stage > div:last-child > div')
      if (ph) gsap.from(ph, { scale: 0.88, y: 40, ease: 'none', scrollTrigger: { trigger: '#stage', start: 'top bottom', end: 'center center', scrub: true } })
      const ch = el.querySelector('#chords > div:first-child > div:last-child')
      if (ch) gsap.from(ch, { y: 80, ease: 'none', scrollTrigger: { trigger: '#chords', start: 'top bottom', end: 'bottom top', scrub: true } })
      q('[data-count]').forEach((n) => {
        const target = parseInt(n.textContent ?? '', 10) || 0
        const o = { v: 0 }
        gsap.to(o, { v: target, duration: 1.4, ease: 'power2.out', onUpdate: () => { n.textContent = String(Math.round(o.v)) }, scrollTrigger: { trigger: n, start: 'top 92%', once: true } })
      })
    }, el)
    return () => { document.removeEventListener('click', onAnchor); ctx.revert() }
  }, [])

  // Cursor follower + pointer-aware cards (fine pointers only, skipped for reduced motion).
  useEffect(() => {
    const el = root.current
    const dot = dotRef.current
    const ring = ringRef.current
    if (!el || !dot || !ring) return
    if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, opacity: 0 })
    const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' }), dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' })
    const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' })
    const cards = Array.from(el.querySelectorAll<HTMLElement>('#features > div:last-child > div, #why > div:last-child > div, section[data-screen-label="Roles"] > div:nth-child(2) > div'))
    cards.forEach((c) => c.classList.add('tilt'))
    const onMove = (e: PointerEvent) => {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY)
      gsap.to([dot, ring], { opacity: 1, duration: 0.2, overwrite: 'auto' })
      const t = e.target as Element
      const hot = !!t.closest?.('a, button')
      const card = t.closest?.('.tilt') as HTMLElement | null
      gsap.to(ring, { scale: hot ? 1.9 : card ? 1.35 : 1, duration: 0.25, overwrite: 'auto' })
      gsap.to(dot, { scale: hot ? 0.4 : 1, duration: 0.2, overwrite: 'auto' })
    }
    const onLeaveWin = () => gsap.to([dot, ring], { opacity: 0, duration: 0.2 })
    const handlers = cards.map((c) => {
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
      return { c, move, leave }
    })
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('pointerleave', onLeaveWin)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeaveWin)
      handlers.forEach(({ c, move, leave }) => {
        c.removeEventListener('pointermove', move)
        c.removeEventListener('pointerleave', leave)
        c.classList.remove('tilt')
        gsap.set(c, { clearProps: 'rotationX,rotationY,y,transformPerspective' })
      })
    }
  }, [])

  const install = async () => {
    if (!deferred) {
      window.alert('To install: open the browser menu and choose "Add to Home Screen" / "Install app".')
      return
    }
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  const heroCta = signedIn ? 'Open your setlists →' : 'Open Setsmith →'
  const navCta = wide ? heroCta : 'Open →'
  const installLabel = 'Install the app'

  return (
    <div ref={root} className="landing" style={{ background: 'var(--bg)', color: 'var(--tx)', minHeight: '100vh', fontFamily: 'var(--font)' }}>
      <header data-screen-label="Top bar" style={{position:"sticky",top:"0",zIndex:"20",background:"color-mix(in srgb,var(--bg) 88%,transparent)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderBottom:"1px solid var(--ln)"}}>
        <div style={{maxWidth:"1320px",margin:"0 auto",padding:"12px 20px",display:"flex",alignItems:"center",gap:"14px"}}>
          <a href="#top" style={{display:"flex",alignItems:"center",gap:"10px",textDecoration:"none"}}>
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#1d1f22" /><g fill="#e2f24a" transform="translate(3,3)"><rect x="13" y="1" width="2" height="11" /><ellipse cx="11.5" cy="11" rx="3.5" ry="3" /><path d="M0 15h26l-4.2 6H4.2z" /><rect x="8" y="21" width="10" height="5" /></g></svg>
            <span style={{fontWeight:"600",fontSize:"21px",letterSpacing:"-.02em"}}>Setsmith</span>
            <span style={{font:"500 10px var(--mono)",letterSpacing:".14em",color:"var(--mu)",paddingLeft:"10px",borderLeft:"1px solid var(--ln)",whiteSpace:"nowrap"}}>BY LAPALU LIYANAGE</span>
          </a>
          <div style={{flex:"1"}}></div>
          {wide && (
      <>
            <nav style={{display:"flex",gap:"4px",alignItems:"center"}}>
              <a href="#why" className="h0" style={{height:"40px",padding:"0 14px",borderRadius:"20px",display:"flex",alignItems:"center",color:"var(--mu)",textDecoration:"none",fontSize:"14px",whiteSpace:"nowrap"}}>Why</a>
              <a href="#features" className="h0" style={{height:"40px",padding:"0 14px",borderRadius:"20px",display:"flex",alignItems:"center",color:"var(--mu)",textDecoration:"none",fontSize:"14px",whiteSpace:"nowrap"}}>Features</a>
              <a href="#how" className="h0" style={{height:"40px",padding:"0 14px",borderRadius:"20px",display:"flex",alignItems:"center",color:"var(--mu)",textDecoration:"none",fontSize:"14px",whiteSpace:"nowrap"}}>How it works</a>
              <a href="#stage" className="h0" style={{height:"40px",padding:"0 14px",borderRadius:"20px",display:"flex",alignItems:"center",color:"var(--mu)",textDecoration:"none",fontSize:"14px",whiteSpace:"nowrap"}}>Stage view</a>
            </nav>
            <button onClick={toggleTheme} aria-label="Toggle theme" className="h1" style={{width:"40px",height:"40px",borderRadius:"50%",border:"1px solid var(--ln)",background:"transparent",color:"var(--mu)",display:"grid",placeItems:"center",cursor:"pointer"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
            </button>
          </>
      )}
          <a href="/app" className="h2" style={{height:"40px",padding:"0 18px",borderRadius:"20px",background:"var(--ac)",color:"var(--ai)",fontWeight:"700",fontSize:"14px",display:"inline-flex",alignItems:"center",gap:"8px",textDecoration:"none",whiteSpace:"nowrap"}}>{navCta}</a>
        </div>
      </header>
      <main id="top" style={{maxWidth:"1320px",margin:"0 auto",padding:"16px 16px 0",display:"flex",flexDirection:"column",gap:"16px"}}>
      <section data-screen-label="Hero" style={{background:"var(--sf)",borderRadius:"32px",padding:"clamp(28px,5vw,64px)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,420px),1fr))",gap:"clamp(32px,4vw,56px)",alignItems:"center",overflow:"hidden"}}>
        <div data-hero-copy="" style={{display:"flex",flexDirection:"column",gap:"24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",font:"500 11px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}><PulseDot /><span>SETLIST PLANNER FOR LIVE BANDS</span></div>
          <h1 style={{margin:"0",fontWeight:"700",fontSize:"clamp(40px,5.6vw,76px)",lineHeight:".98",letterSpacing:"-.035em",textWrap:"balance"}}>Plan the whole night. Play it from one screen.</h1>
          <p style={{margin:"0",fontSize:"clamp(16px,1.4vw,19px)",lineHeight:"1.5",color:"var(--mu)",maxWidth:"560px",textWrap:"pretty"}}>Book a show, split it into sessions, add songs from YouTube, give each one a singer — Setsmith checks the timing, keys and tempo flow, then sends the band a PDF and runs the gig on your phone.</p>
          <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
            <a href="/app" className="h3" style={{height:"48px",padding:"0 22px",borderRadius:"24px",background:"var(--ac)",color:"var(--ai)",fontWeight:"700",fontSize:"15px",display:"inline-flex",alignItems:"center",textDecoration:"none"}}>{heroCta}</a>
            <a href="#how" className="h1" style={{height:"48px",padding:"0 22px",borderRadius:"24px",border:"1px solid var(--ln)",color:"var(--mu)",fontWeight:"500",fontSize:"15px",display:"inline-flex",alignItems:"center",textDecoration:"none"}}>See how it works</a>
          </div>
          <div style={{font:"500 11px var(--mono)",letterSpacing:".08em",color:"var(--mu)"}}>FREE · WORKS IN THE BROWSER · ANDROID &amp; iOS</div>
        </div>
        <div data-hero-visual="" style={{position:"relative",padding:"0 0 clamp(40px,6vw,80px)"}}>
          <div style={{background:"var(--p2)",borderRadius:"20px",boxShadow:"0 30px 70px rgba(30,34,20,.22)",overflow:"hidden",border:"1px solid var(--ln)",transform:"perspective(1600px) rotateY(-6deg) rotateX(3deg)",transformOrigin:"left center"}}>
            <div style={{height:"28px",display:"flex",alignItems:"center",gap:"6px",padding:"0 12px",borderBottom:"1px solid var(--ln)",background:"var(--p1)"}}>
              <span style={{width:"8px",height:"8px",borderRadius:"50%",background:"var(--ln)"}}></span><span style={{width:"8px",height:"8px",borderRadius:"50%",background:"var(--ln)"}}></span><span style={{width:"8px",height:"8px",borderRadius:"50%",background:"var(--ln)"}}></span>
              <span style={{marginLeft:"10px",font:"500 10px var(--mono)",color:"var(--mu)"}}>setsmith.lapalu.me/app</span>
            </div>
            <img src="/landing/setlist.jpg" alt="Setsmith setlist editor with four sessions for TD2026" style={{display:"block",width:"100%",height:"auto"}} />
          </div>
          <div data-hero-phone="" style={{position:"absolute",right:"-4%",bottom:"0",width:"40%",aspectRatio:"577/765",background:"#000",borderRadius:"28px",border:"6px solid #1f2124",boxShadow:"0 30px 60px rgba(0,0,0,.35)",overflow:"hidden"}}>
            <img src="/landing/stage-chords.png" alt="Stage view with the current song and its chord sheet" style={{display:"block",width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} />
          </div>
        </div>
      </section>
      <section data-screen-label="Proof" style={{background:"var(--p1)",borderRadius:"24px",padding:"24px clamp(20px,3vw,40px)",display:"flex",flexWrap:"wrap",alignItems:"center",gap:"20px 48px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"6px",flex:"1 1 260px"}}>
          <span style={{font:"500 10px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>USED FOR A REAL SHOW</span>
          <span style={{fontSize:"18px"}}>Used for <b>TD2026</b> · Faculty of Applied Sciences, RUSL</span>
        </div>
        <div style={{display:"flex",gap:"clamp(24px,4vw,56px)",flexWrap:"wrap"}}>
          <div style={{display:"flex",flexDirection:"column"}}><span data-count="" style={{font:"700 clamp(36px,4vw,52px)/1 var(--mono)",letterSpacing:"-.03em"}}>4</span><span style={{font:"500 10px var(--mono)",letterSpacing:".12em",color:"var(--mu)",marginTop:"6px"}}>SESSIONS</span></div>
          <div style={{display:"flex",flexDirection:"column"}}><span data-count="" style={{font:"700 clamp(36px,4vw,52px)/1 var(--mono)",letterSpacing:"-.03em"}}>38</span><span style={{font:"500 10px var(--mono)",letterSpacing:".12em",color:"var(--mu)",marginTop:"6px"}}>SONGS</span></div>
          <div style={{display:"flex",flexDirection:"column"}}><span data-count="" style={{font:"700 clamp(36px,4vw,52px)/1 var(--mono)",letterSpacing:"-.03em"}}>17</span><span style={{font:"500 10px var(--mono)",letterSpacing:".12em",color:"var(--mu)",marginTop:"6px"}}>SINGERS</span></div>
        </div>
      </section>
      <section id="why" data-screen-label="Why" style={{scrollMarginTop:"80px",background:"var(--sf)",borderRadius:"32px",padding:"clamp(28px,5vw,64px)",display:"flex",flexDirection:"column",gap:"32px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"12px",maxWidth:"720px"}}>
          <span style={{font:"500 11px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>WHY WE BUILT IT</span>
          <h2 style={{margin:"0",fontWeight:"700",fontSize:"clamp(30px,3.6vw,48px)",lineHeight:"1.04",letterSpacing:"-.03em",textWrap:"balance"}}>From WhatsApp chaos to a finished setlist.</h2>
          <p style={{margin:"0",color:"var(--mu)",fontSize:"16px",textWrap:"pretty"}}>Built by Lapalu Liyanage. Used by FASTUNES Music Society at Rajarata University of Sri Lanka to run its shows.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,340px),1fr))",gap:"16px"}}>
          <div style={{background:"var(--p1)",borderRadius:"24px",padding:"28px",display:"flex",flexDirection:"column",gap:"16px"}}>
            <span style={{alignSelf:"flex-start",height:"24px",padding:"0 10px",borderRadius:"12px",background:"var(--wr)",color:"#fff",font:"700 10px var(--mono)",letterSpacing:".12em",display:"inline-flex",alignItems:"center"}}>BEFORE</span>
            <div style={{display:"flex",flexDirection:"column",gap:"12px",color:"var(--mu)"}}>
              <div style={{display:"flex",gap:"12px"}}><span style={{color:"var(--wr)",fontWeight:"700"}}>×</span><span>Setlists passed around in WhatsApp groups and spreadsheets</span></div>
              <div style={{display:"flex",gap:"12px"}}><span style={{color:"var(--wr)",fontWeight:"700"}}>×</span><span>Nobody knows the real running time</span></div>
              <div style={{display:"flex",gap:"12px"}}><span style={{color:"var(--wr)",fontWeight:"700"}}>×</span><span>Singers find out their songs late</span></div>
              <div style={{display:"flex",gap:"12px"}}><span style={{color:"var(--wr)",fontWeight:"700"}}>×</span><span>Key clashes discovered on stage</span></div>
              <div style={{display:"flex",gap:"12px"}}><span style={{color:"var(--wr)",fontWeight:"700"}}>×</span><span>Printed lists lose the YouTube links</span></div>
            </div>
          </div>
          <div style={{background:"var(--p2)",borderRadius:"24px",padding:"28px",display:"flex",flexDirection:"column",gap:"16px",boxShadow:"0 2px 8px var(--sh)"}}>
            <span style={{alignSelf:"flex-start",height:"24px",padding:"0 10px",borderRadius:"12px",background:"var(--ac)",color:"var(--ai)",font:"700 10px var(--mono)",letterSpacing:".12em",display:"inline-flex",alignItems:"center"}}>AFTER</span>
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              <div style={{display:"flex",gap:"12px",alignItems:"baseline"}}><span style={{flex:"none",width:"8px",height:"8px",borderRadius:"50%",background:"var(--ac)",boxShadow:"0 0 0 2px var(--tx)",transform:"translateY(-1px)"}}></span><span>One shared setlist for the whole band</span></div>
              <div style={{display:"flex",gap:"12px",alignItems:"baseline"}}><span style={{flex:"none",width:"8px",height:"8px",borderRadius:"50%",background:"var(--ac)",boxShadow:"0 0 0 2px var(--tx)",transform:"translateY(-1px)"}}></span><span>Live totals against the booked slot</span></div>
              <div style={{display:"flex",gap:"12px",alignItems:"baseline"}}><span style={{flex:"none",width:"8px",height:"8px",borderRadius:"50%",background:"var(--ac)",boxShadow:"0 0 0 2px var(--tx)",transform:"translateY(-1px)"}}></span><span>Every singer and key visible up front</span></div>
              <div style={{display:"flex",gap:"12px",alignItems:"baseline"}}><span style={{flex:"none",width:"8px",height:"8px",borderRadius:"50%",background:"var(--ac)",boxShadow:"0 0 0 2px var(--tx)",transform:"translateY(-1px)"}}></span><span>A PDF with YouTube links and QR codes</span></div>
              <div style={{display:"flex",gap:"12px",alignItems:"baseline"}}><span style={{flex:"none",width:"8px",height:"8px",borderRadius:"50%",background:"var(--ac)",boxShadow:"0 0 0 2px var(--tx)",transform:"translateY(-1px)"}}></span><span>A stage screen on the night</span></div>
            </div>
          </div>
        </div>
      </section>
      <section id="features" data-screen-label="Features" style={{scrollMarginTop:"80px",background:"var(--sf)",borderRadius:"32px",padding:"clamp(28px,5vw,64px)",display:"flex",flexDirection:"column",gap:"32px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <span style={{font:"500 11px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>FEATURES</span>
          <h2 style={{margin:"0",fontWeight:"700",fontSize:"clamp(30px,3.6vw,48px)",lineHeight:"1.04",letterSpacing:"-.03em",maxWidth:"720px",textWrap:"balance"}}>Everything a band manager checks twice.</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,270px),1fr))",gap:"12px"}}>
          <div style={{background:"var(--p1)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"12px"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            <b style={{fontSize:"17px",fontWeight:"600",letterSpacing:"-.01em"}}>Sessions &amp; timing</b>
            <span style={{color:"var(--mu)",fontSize:"14px",flex:"1"}}>Dinner, dance, encore. Target times with live totals — warns when you run over.</span>
            <span style={{font:"500 11px var(--mono)",color:"var(--mu)"}}>42:12 / 45:00 · <span style={{color:"var(--tx)"}}>2:48 left</span></span>
          </div>
          <div style={{background:"var(--p1)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"12px"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17" /><path d="m10 15 5-3-5-3z" /></svg>
            <b style={{fontSize:"17px",fontWeight:"600",letterSpacing:"-.01em"}}>Songs from YouTube</b>
            <span style={{color:"var(--mu)",fontSize:"14px",flex:"1"}}>Paste a link or search. Title and length fill in.</span>
            <span style={{font:"500 11px var(--mono)",color:"var(--mu)"}}>youtu.be/… → 4:15</span>
          </div>
          <div style={{background:"var(--p1)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"12px"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            <b style={{fontSize:"17px",fontWeight:"600",letterSpacing:"-.01em"}}>BPM, key &amp; Camelot</b>
            <span style={{color:"var(--mu)",fontSize:"14px",flex:"1"}}>Automatic lookup, tap tempo, or manual. Warns on big key jumps.</span>
            <span style={{font:"500 11px var(--mono)",color:"var(--mu)"}}>128 BPM · Dm · <span style={{color:"var(--tx)"}}>7A</span></span>
          </div>
          <div style={{background:"var(--p1)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"12px"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19v3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><rect x="9" y="2" width="6" height="13" rx="3" /></svg>
            <b style={{fontSize:"17px",fontWeight:"600",letterSpacing:"-.01em"}}>Singer balance</b>
            <span style={{color:"var(--mu)",fontSize:"14px",flex:"1"}}>A singer per song, key-range transpose suggestions, flags more than 3 in a row.</span>
            <span style={{font:"500 11px var(--mono)",color:"var(--wr)"}}>! kama × 4 in a row</span>
          </div>
          <div style={{background:"var(--p1)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"12px"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></svg>
            <b style={{fontSize:"17px",fontWeight:"600",letterSpacing:"-.01em"}}>Drag, swap, auto-arrange</b>
            <span style={{color:"var(--mu)",fontSize:"14px",flex:"1"}}>Drag across sessions, quick ⇄ swap, auto-order by BPM with an energy map. Undo anything.</span>
            <Sparkline />
          </div>
          <div style={{background:"var(--p1)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"12px"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" /><path d="M12 18h.01" /></svg>
            <b style={{fontSize:"17px",fontWeight:"600",letterSpacing:"-.01em"}}>Stage view</b>
            <span style={{color:"var(--mu)",fontSize:"14px",flex:"1"}}>Huge-type current and next song, beat-pulse dot, swipe or page-turner pedal. Screen stays awake.</span>
            <span style={{font:"500 11px var(--mono)",color:"var(--mu)"}}>NOW · 12 → NEXT · 13</span>
          </div>
          <div style={{background:"var(--p1)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"12px"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            <b style={{fontSize:"17px",fontWeight:"600",letterSpacing:"-.01em"}}>Chord sheets</b>
            <span style={{color:"var(--mu)",fontSize:"14px",flex:"1"}}>Open full-screen from stage view. Export to PDF.</span>
            <span style={{font:"500 11px var(--mono)",color:"var(--mu)"}}>Dm · Bb · F · C</span>
          </div>
          <div style={{background:"var(--p1)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"12px"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 13H8" /><path d="M16 17H8" /></svg>
            <b style={{fontSize:"17px",fontWeight:"600",letterSpacing:"-.01em"}}>PDF to the band</b>
            <span style={{color:"var(--mu)",fontSize:"14px",flex:"1"}}>Per-session tables, YouTube links and QR codes, Sinhala script. Share straight to WhatsApp.</span>
            <span style={{font:"500 11px var(--mono)",color:"var(--mu)"}}>TD2026.pdf · 4 sessions</span>
          </div>
        </div>
      </section>
      <section id="how" data-screen-label="How it works" style={{scrollMarginTop:"80px",background:"var(--sf)",borderRadius:"32px",padding:"clamp(28px,5vw,64px)",display:"flex",flexDirection:"column",gap:"36px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <span style={{font:"500 11px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>HOW IT WORKS</span>
          <h2 style={{margin:"0",fontWeight:"700",fontSize:"clamp(30px,3.6vw,48px)",lineHeight:"1.04",letterSpacing:"-.03em"}}>Four steps to show night.</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:"28px 20px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:"12px",borderTop:"2px solid var(--ln)",paddingTop:"20px",position:"relative"}}>
            <span style={{position:"absolute",top:"-7px",left:"0",width:"12px",height:"12px",borderRadius:"50%",background:"var(--ac)",boxShadow:"0 0 0 2px var(--tx)"}}></span>
            <span style={{font:"700 12px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>01</span>
            <b style={{fontSize:"20px",fontWeight:"600",letterSpacing:"-.015em"}}>Book the show</b>
            <span style={{color:"var(--mu)"}}>Date, venue and the booked slot.</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"12px",borderTop:"2px solid var(--ln)",paddingTop:"20px",position:"relative"}}>
            <span style={{position:"absolute",top:"-7px",left:"0",width:"12px",height:"12px",borderRadius:"50%",background:"var(--p2)",boxShadow:"0 0 0 2px var(--tx)"}}></span>
            <span style={{font:"700 12px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>02</span>
            <b style={{fontSize:"20px",fontWeight:"600",letterSpacing:"-.015em"}}>Build the sessions</b>
            <span style={{color:"var(--mu)"}}>Add songs, assign singers — BPM and key fill in.</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"12px",borderTop:"2px solid var(--ln)",paddingTop:"20px",position:"relative"}}>
            <span style={{position:"absolute",top:"-7px",left:"0",width:"12px",height:"12px",borderRadius:"50%",background:"var(--p2)",boxShadow:"0 0 0 2px var(--tx)"}}></span>
            <span style={{font:"700 12px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>03</span>
            <b style={{fontSize:"20px",fontWeight:"600",letterSpacing:"-.015em"}}>Shape the flow</b>
            <span style={{color:"var(--mu)"}}>Drag, swap, auto-arrange. Fix the warnings.</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"12px",borderTop:"2px solid var(--ln)",paddingTop:"20px",position:"relative"}}>
            <span style={{position:"absolute",top:"-7px",left:"0",width:"12px",height:"12px",borderRadius:"50%",background:"var(--p2)",boxShadow:"0 0 0 2px var(--tx)"}}></span>
            <span style={{font:"700 12px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>04</span>
            <b style={{fontSize:"20px",fontWeight:"600",letterSpacing:"-.015em"}}>Send &amp; play</b>
            <span style={{color:"var(--mu)"}}>PDF to the band, Stage view on the night.</span>
          </div>
        </div>
      </section>
      <section id="stage" data-screen-label="Stage view" style={{scrollMarginTop:"80px",background:"#0c0d0e",color:"#ecede8",borderRadius:"32px",padding:"clamp(28px,5vw,64px)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,400px),1fr))",gap:"clamp(32px,5vw,64px)",alignItems:"center"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"28px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            <span style={{font:"500 11px var(--mono)",letterSpacing:".12em",color:"#e2f24a"}}>STAGE VIEW</span>
            <h2 style={{margin:"0",fontWeight:"700",fontSize:"clamp(32px,4.2vw,56px)",lineHeight:"1",letterSpacing:"-.035em",textWrap:"balance"}}>Your setlist becomes the gig screen.</h2>
          </div>
          <div style={{display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",gap:"16px",padding:"18px 0",borderTop:"1px solid #303236"}}><span style={{font:"700 12px var(--mono)",color:"#9a9e99",width:"24px"}}>01</span><div style={{display:"flex",flexDirection:"column",gap:"4px"}}><b style={{fontWeight:"600",fontSize:"17px"}}>Now / Next in huge type</b><span style={{color:"#9a9e99",fontSize:"14px"}}>Readable from the drum riser. Singer, key and Camelot underneath.</span></div></div>
            <div style={{display:"flex",gap:"16px",padding:"18px 0",borderTop:"1px solid #303236"}}><span style={{font:"700 12px var(--mono)",color:"#9a9e99",width:"24px"}}>02</span><div style={{display:"flex",flexDirection:"column",gap:"4px"}}><b style={{fontWeight:"600",fontSize:"17px"}}>Beat-pulse dot</b><span style={{color:"#9a9e99",fontSize:"14px"}}>A lime dot pulses at the song's tempo for a quiet count-in.</span></div></div>
            <div style={{display:"flex",gap:"16px",padding:"18px 0",borderTop:"1px solid #303236",borderBottom:"1px solid #303236"}}><span style={{font:"700 12px var(--mono)",color:"#9a9e99",width:"24px"}}>03</span><div style={{display:"flex",flexDirection:"column",gap:"4px"}}><b style={{fontWeight:"600",fontSize:"17px"}}>Swipe or page-turner pedal</b><span style={{color:"#9a9e99",fontSize:"14px"}}>Hands-free advance. The screen stays awake all set.</span></div></div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"center"}}>
          <div style={{position:"relative",width:"min(100%,460px)",aspectRatio:"577/765",background:"#000",borderRadius:"40px",border:"8px solid #26282b",boxShadow:"0 40px 80px rgba(0,0,0,.6)",overflow:"hidden"}}>
            <img src="/landing/stage-chords.png" alt="Stage view showing the current song in huge type, transpose and capo controls, and the chord sheet" style={{display:"block",width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} />
          </div>
        </div>
      </section>
      <section id="chords" data-screen-label="Chord sheets" style={{scrollMarginTop:"80px",background:"var(--sf)",borderRadius:"32px",padding:"clamp(28px,5vw,64px)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,360px),1fr))",gap:"clamp(32px,5vw,64px)",alignItems:"center"}}>
        <div style={{position:"relative",width:"min(100%,560px)",margin:"0 auto",padding:"0 18% 0 0"}}>
          <div style={{background:"#151618",borderRadius:"20px",border:"1px solid var(--ln)",boxShadow:"0 30px 70px rgba(30,34,20,.22)",overflow:"hidden"}}>
            <div style={{height:"28px",display:"flex",alignItems:"center",gap:"6px",padding:"0 12px",borderBottom:"1px solid #303236",background:"#1d1e21"}}>
              <span style={{width:"8px",height:"8px",borderRadius:"50%",background:"#303236"}}></span><span style={{width:"8px",height:"8px",borderRadius:"50%",background:"#303236"}}></span><span style={{width:"8px",height:"8px",borderRadius:"50%",background:"#303236"}}></span>
              <span style={{marginLeft:"10px",font:"500 10px var(--mono)",color:"#9a9e99"}}>Full-screen chord sheet</span>
            </div>
            <img src="/landing/chords-fullscreen.png" alt="Full-screen chord sheet with intro chord grid, chorus and verses, and a control bar for transpose, capo, auto-scroll and edit" style={{display:"block",width:"100%",height:"auto"}} />
          </div>
          <div style={{position:"absolute",right:"0",bottom:"-6%",width:"38%",aspectRatio:"739/1600",background:"#000",borderRadius:"30px",border:"6px solid #1f2124",boxShadow:"0 30px 60px rgba(0,0,0,.35)",overflow:"hidden"}}>
            <img src="/landing/chords.jpg" alt="Chord sheet on a phone" style={{display:"block",width:"100%",height:"100%",objectFit:"cover"}} />
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"24px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            <span style={{font:"500 11px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>CHORD SHEETS</span>
            <h2 style={{margin:"0",fontWeight:"700",fontSize:"clamp(30px,3.6vw,48px)",lineHeight:"1.04",letterSpacing:"-.03em",textWrap:"balance"}}>The chords, right where you're playing.</h2>
            <p style={{margin:"0",color:"var(--mu)",fontSize:"16px",textWrap:"pretty"}}>Open any song's sheet full-screen from stage view. Chords sit above the lyrics, Sinhala songs included.</p>
          </div>
          <div style={{display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",gap:"16px",padding:"16px 0",borderTop:"1px solid var(--ln)"}}><span style={{font:"700 12px var(--mono)",color:"var(--mu)",width:"24px"}}>01</span><div style={{display:"flex",flexDirection:"column",gap:"4px"}}><b style={{fontWeight:"600",fontSize:"17px"}}>Transpose &amp; capo</b><span style={{color:"var(--mu)",fontSize:"14px"}}>Shift the key to fit the singer. Every chord updates.</span></div></div>
            <div style={{display:"flex",gap:"16px",padding:"16px 0",borderTop:"1px solid var(--ln)"}}><span style={{font:"700 12px var(--mono)",color:"var(--mu)",width:"24px"}}>02</span><div style={{display:"flex",flexDirection:"column",gap:"4px"}}><b style={{fontWeight:"600",fontSize:"17px"}}>Auto-scroll</b><span style={{color:"var(--mu)",fontSize:"14px"}}>Hands stay on the instrument. Set the speed and go.</span></div></div>
            <div style={{display:"flex",gap:"16px",padding:"16px 0",borderTop:"1px solid var(--ln)"}}><span style={{font:"700 12px var(--mono)",color:"var(--mu)",width:"24px"}}>03</span><div style={{display:"flex",flexDirection:"column",gap:"4px"}}><b style={{fontWeight:"600",fontSize:"17px"}}>Text size &amp; 2 columns</b><span style={{color:"var(--mu)",fontSize:"14px"}}>Fit a whole song on one screen.</span></div></div>
            <div style={{display:"flex",gap:"16px",padding:"16px 0",borderTop:"1px solid var(--ln)",borderBottom:"1px solid var(--ln)"}}><span style={{font:"700 12px var(--mono)",color:"var(--mu)",width:"24px"}}>04</span><div style={{display:"flex",flexDirection:"column",gap:"4px"}}><b style={{fontWeight:"600",fontSize:"17px"}}>Edit &amp; private notes</b><span style={{color:"var(--mu)",fontSize:"14px"}}>Fix a chord on the spot, or add notes only you can see. Export to PDF.</span></div></div>
          </div>
        </div>
      </section>
      <section data-screen-label="Roles" style={{background:"var(--sf)",borderRadius:"32px",padding:"clamp(28px,5vw,64px)",display:"flex",flexDirection:"column",gap:"32px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <span style={{font:"500 11px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>ROLES &amp; SHARING</span>
          <h2 style={{margin:"0",fontWeight:"700",fontSize:"clamp(30px,3.6vw,48px)",lineHeight:"1.04",letterSpacing:"-.03em"}}>Built for the whole band.</h2>
          <p style={{margin:"0",color:"var(--mu)",fontSize:"16px"}}>Only the manager and editors need accounts.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))",gap:"12px"}}>
          <div style={{background:"var(--p2)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"8px",boxShadow:"0 2px 8px var(--sh)"}}><span style={{alignSelf:"flex-start",height:"24px",padding:"0 10px",borderRadius:"12px",background:"var(--ac)",color:"var(--ai)",font:"700 10px var(--mono)",letterSpacing:".1em",display:"inline-flex",alignItems:"center"}}>MANAGER</span><b style={{fontWeight:"600",fontSize:"17px",marginTop:"6px"}}>Owns the band</b><span style={{color:"var(--mu)",fontSize:"14px"}}>Creates shows, invites members, sets roles.</span></div>
          <div style={{background:"var(--p1)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"8px"}}><span style={{alignSelf:"flex-start",height:"24px",padding:"0 10px",borderRadius:"12px",background:"var(--dk)",color:"var(--dki)",font:"700 10px var(--mono)",letterSpacing:".1em",display:"inline-flex",alignItems:"center"}}>EDITOR</span><b style={{fontWeight:"600",fontSize:"17px",marginTop:"6px"}}>Changes the setlist</b><span style={{color:"var(--mu)",fontSize:"14px"}}>Adds songs, moves them, assigns singers.</span></div>
          <div style={{background:"var(--p1)",borderRadius:"22px",padding:"22px",display:"flex",flexDirection:"column",gap:"8px"}}><span style={{alignSelf:"flex-start",height:"24px",padding:"0 10px",borderRadius:"12px",border:"1px solid var(--ln)",color:"var(--mu)",font:"700 10px var(--mono)",letterSpacing:".1em",display:"inline-flex",alignItems:"center"}}>VIEWER</span><b style={{fontWeight:"600",fontSize:"17px",marginTop:"6px"}}>Sees it</b><span style={{color:"var(--mu)",fontSize:"14px"}}>Follows along — always the latest version.</span></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"14px",flexWrap:"wrap",border:"1px dashed var(--ln)",borderRadius:"22px",padding:"18px 22px"}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
          <span style={{flex:"1 1 240px"}}><b style={{fontWeight:"600"}}>Public read-only link</b> <span style={{color:"var(--mu)"}}>— anyone can follow the live setlist and current song, no account needed.</span></span>
          <span style={{font:"500 11px var(--mono)",color:"var(--mu)"}}>/app?share=…</span>
        </div>
      </section>
      <section data-screen-label="Library" style={{background:"var(--sf)",borderRadius:"32px",padding:"clamp(28px,5vw,64px)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,340px),1fr))",gap:"clamp(28px,4vw,56px)",alignItems:"center"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
          <span style={{font:"500 11px var(--mono)",letterSpacing:".12em",color:"var(--mu)"}}>SONG LIBRARY</span>
          <h2 style={{margin:"0",fontWeight:"700",fontSize:"clamp(30px,3.6vw,48px)",lineHeight:"1.04",letterSpacing:"-.03em",textWrap:"balance"}}>Every song you've ever played.</h2>
          <p style={{margin:"0",color:"var(--mu)",fontSize:"16px",textWrap:"pretty"}}>Filter by singer, language, BPM or key — then one tap adds it to the next show.</p>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            <span style={{height:"32px",padding:"0 14px",borderRadius:"16px",background:"var(--p2)",display:"inline-flex",alignItems:"center",gap:"8px",fontSize:"13px",fontWeight:"600",boxShadow:"0 2px 8px var(--sh)"}}><span style={{width:"8px",height:"8px",borderRadius:"50%",background:"var(--ac)",boxShadow:"0 0 0 2px var(--tx)"}}></span>Singer</span>
            <span style={{height:"32px",padding:"0 14px",borderRadius:"16px",border:"1px solid var(--ln)",display:"inline-flex",alignItems:"center",fontSize:"13px",color:"var(--mu)"}}>Language</span>
            <span style={{height:"32px",padding:"0 14px",borderRadius:"16px",border:"1px solid var(--ln)",display:"inline-flex",alignItems:"center",font:"500 12px var(--mono)",color:"var(--mu)"}}>BPM 90–130</span>
            <span style={{height:"32px",padding:"0 14px",borderRadius:"16px",border:"1px solid var(--ln)",display:"inline-flex",alignItems:"center",font:"500 12px var(--mono)",color:"var(--mu)"}}>KEY 7A</span>
          </div>
        </div>
        <div style={{background:"var(--p2)",borderRadius:"20px",overflow:"hidden",border:"1px solid var(--ln)",boxShadow:"0 24px 60px rgba(30,34,20,.16)"}}>
          <img src="/landing/library.jpg" alt="Setsmith song library" style={{display:"block",width:"100%",height:"auto"}} />
        </div>
      </section>
      <section data-screen-label="Under the hood" style={{background:"var(--p1)",borderRadius:"24px",padding:"28px clamp(20px,3vw,40px)",display:"flex",flexDirection:"column",gap:"18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <span style={{font:"500 11px var(--mono)",letterSpacing:".12em",color:"var(--mu)",flex:"1"}}>UNDER THE HOOD</span>
          <a href="https://github.com/LapaluLiyanage/setsmith" className="h4" style={{height:"40px",padding:"0 16px",borderRadius:"20px",background:"var(--dk)",color:"var(--dki)",fontWeight:"600",fontSize:"13px",display:"inline-flex",alignItems:"center",gap:"8px",textDecoration:"none"}}>View on GitHub →</a>
        </div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
          {TECH.map((t) => (
      <span key={t} style={{height:"30px",padding:"0 12px",borderRadius:"15px",border:"1px solid var(--ln)",background:"var(--p2)",display:"inline-flex",alignItems:"center",font:"500 12px var(--mono)",color:"var(--tx)"}}>{t}</span>
      ))}
        </div>
      </section>
      <section data-screen-label="Final CTA" style={{background:"#1f2124",color:"#f2f2ee",borderRadius:"32px",padding:"clamp(36px,6vw,80px)",display:"flex",flexWrap:"wrap",alignItems:"flex-end",justifyContent:"space-between",gap:"28px"}}>
        <h2 style={{margin:"0",fontWeight:"700",fontSize:"clamp(36px,5.2vw,72px)",lineHeight:".98",letterSpacing:"-.035em",maxWidth:"720px",textWrap:"balance"}}>Your next show starts here.</h2>
        <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
          <a href="/app" className="h5" style={{height:"48px",padding:"0 22px",borderRadius:"24px",background:"#e2f24a",color:"#1d1f22",fontWeight:"700",fontSize:"15px",display:"inline-flex",alignItems:"center",textDecoration:"none"}}>Open Setsmith →</a>
          <button onClick={install} className="h6" style={{height:"48px",padding:"0 22px",borderRadius:"24px",border:"1px solid #3a3c40",background:"transparent",color:"#c7cac4",font:"500 15px var(--font)",cursor:"pointer"}}>{installLabel}</button>
        </div>
      </section>
      </main>
      <footer data-screen-label="Footer" style={{maxWidth:"1320px",margin:"0 auto",padding:"36px 32px 48px",display:"flex",flexWrap:"wrap",gap:"20px 40px",justifyContent:"space-between",color:"var(--mu)",fontSize:"13px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"6px",maxWidth:"520px"}}>
          <span style={{color:"var(--tx)",fontWeight:"600"}}>Setsmith by Lapalu Liyanage · <a href="https://lapalu.me" style={{color:"var(--tx)"}}>lapalu.me</a></span>
          <span>Used by FASTUNES Music Society, Faculty of Applied Sciences, Rajarata University of Sri Lanka</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"6px",alignItems:"flex-start"}}>
          <div style={{display:"flex",gap:"16px",flexWrap:"wrap"}}>
            <a href="https://github.com/LapaluLiyanage/setsmith" style={{color:"var(--tx)"}}>GitHub</a>
          </div>
          <a href="https://getsongbpm.com" style={{color:"var(--tx)",font:"500 12px var(--mono)"}}>BPM &amp; key data via GetSongBPM.com</a>
          <span style={{font:"500 11px var(--mono)"}}>© 2026</span>
        </div>
      </footer>      <div ref={ringRef} className="cursor-ring" aria-hidden />
      <div ref={dotRef} className="cursor-dot" aria-hidden />
    </div>
  )
}
