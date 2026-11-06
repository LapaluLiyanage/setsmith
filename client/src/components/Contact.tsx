import { gsap } from 'gsap'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../state/theme'
import { PointerFx } from './PointerFx'
import './landing.css'
import './contact.css'

type Kind = 'suggestion' | 'question' | 'bug' | 'other'

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: 'suggestion', label: 'Suggestion', hint: 'An idea or something you wish Setsmith did.' },
  { id: 'question', label: 'Question', hint: 'Something you want to ask about Setsmith.' },
  { id: 'bug', label: 'Bug', hint: 'Something broke. Tell us what you did and what happened.' },
  { id: 'other', label: 'Other', hint: 'Anything else.' },
]

const HEADLINE = 'Tell us what would make your shows easier.'
const CARDS = '.contact__method, .contact__me'

const COOLDOWN_KEY = 'setsmith:feedback-at'
const COOLDOWN_MS = 30_000

function secondsLeft(): number {
  try {
    const at = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0)
    return Math.max(0, Math.ceil((at + COOLDOWN_MS - Date.now()) / 1000))
  } catch {
    return 0
  }
}

/** /contact: contact details up top, then a suggestion form beside a photo. Messages land in the Supabase `feedback` table. */
export default function Contact() {
  const [, toggleTheme] = useTheme()
  const root = useRef<HTMLDivElement>(null)
  const [kind, setKind] = useState<Kind>('suggestion')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [trap, setTrap] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const prev = document.title
    document.title = 'Contact — Setsmith'
    return () => { document.title = prev }
  }, [])

  // Entrance animation: header, headline word by word, then the contact cards, form and photo.
  useEffect(() => {
    const el = root.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.25 })
      tl.from('.contact__bar', { y: -40, opacity: 0, duration: 0.6 })
        .from('.contact__eyebrow', { y: 16, opacity: 0, duration: 0.5 }, 0.1)
        .from('.contact__word > span', { yPercent: 110, duration: 0.8, stagger: 0.07 }, 0.15)
        .from('.contact__lede', { y: 20, opacity: 0, duration: 0.6 }, '-=0.4')
        .from('.contact__method', { y: 40, opacity: 0, duration: 0.7, stagger: 0.1 }, '-=0.3')
        .from('.contact__card', { y: 50, opacity: 0, duration: 0.8 }, '-=0.45')
        .from('.contact__me', { y: 50, opacity: 0, duration: 0.8 }, '<0.1')
        .from('.contact__me img', { clipPath: 'inset(0 0 100% 0)', scale: 1.15, duration: 1.1, ease: 'power3.inOut' }, '<0.15')
    }, el)
    return () => ctx.revert()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (trap) { setSent(true); return } // a bot filled the hidden field: pretend it worked
    const wait = secondsLeft()
    if (wait > 0) { setError(`Please wait ${wait}s before sending another message.`); return }
    if (!supabase) { setError('Sending is not available right now. Please try again later.'); return }
    setBusy(true)
    const { error: err } = await supabase.from('feedback').insert({
      kind,
      name: name.trim() || null,
      email: email.trim() || null,
      message: message.trim(),
    })
    setBusy(false)
    if (err) { setError('Could not send your message. Please try again in a moment.'); return }
    try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())) } catch { /* cooldown just won't persist */ }
    setSent(true)
    setMessage('')
  }

  const active = KINDS.find((k) => k.id === kind)!

  return (
    <div ref={root} className="contact landing">
      <header className="contact__bar">
        <a href="/" className="contact__brand">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#1d1f22" /><g fill="#e2f24a" transform="translate(3,3)"><rect x="13" y="1" width="2" height="11" /><ellipse cx="11.5" cy="11" rx="3.5" ry="3" /><path d="M0 15h26l-4.2 6H4.2z" /><rect x="8" y="21" width="10" height="5" /></g></svg>
          <span>Setsmith</span>
        </a>
        <div style={{ flex: 1 }} />
        <a href="/" className="contact__link">Home</a>
        <button type="button" className="contact__icon" onClick={toggleTheme} aria-label="Toggle theme">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
        </button>
        <a href="/app" className="contact__cta">Open Setsmith →</a>
      </header>

      <main className="contact__main">
        <section className="contact__hero">
          <span className="contact__eyebrow">CONTACT &amp; SUGGESTIONS</span>
          <h1 aria-label={HEADLINE}>
            {HEADLINE.split(' ').map((w, i) => (
              <span key={i} aria-hidden><span className="contact__word"><span>{w}</span></span>{' '}</span>
            ))}
          </h1>
          <p className="contact__lede">Ideas, questions and bug reports all land in one inbox and get read. You don&rsquo;t need an account, and the email is optional unless you want a reply.</p>
        </section>

        <section className="contact__methods" aria-label="Ways to reach us">
          <a className="contact__method" href="mailto:lapaluliyanage@gmail.com">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
            <span className="contact__label">EMAIL</span>
            <b>lapaluliyanage@gmail.com</b>
            <i aria-hidden>↗</i>
          </a>
          <a className="contact__method" href="tel:+94774680396">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
            <span className="contact__label">PHONE</span>
            <b>+94 77 468 0396</b>
            <i aria-hidden>↗</i>
          </a>
          <a className="contact__method" href="https://lapalu.me" target="_blank" rel="noopener noreferrer">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></svg>
            <span className="contact__label">PORTFOLIO</span>
            <b>lapalu.me</b>
            <i aria-hidden>↗</i>
          </a>
        </section>

        <div className="contact__split">
          <section className="contact__card">
            {sent ? (
              <div className="contact__done" role="status">
                <span className="contact__tick" aria-hidden>✓</span>
                <h2>Thanks, that&rsquo;s sent.</h2>
                <p>We read every message. If you left an email, expect a reply there.</p>
                <button type="button" className="contact__btn contact__btn--ghost" onClick={() => setSent(false)}>Send another</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 className="contact__formtitle">Send a message</h2>
                <div className="contact__kinds" role="tablist" aria-label="Type of message">
                  {KINDS.map((k) => (
                    <button type="button" key={k.id} role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'is-on' : ''} onClick={() => setKind(k.id)}>{k.label}</button>
                  ))}
                </div>
                <p className="contact__hint">{active.hint}</p>
                <div className="contact__row">
                  <label><div>Name <span>(optional)</span></div>
                    <input value={name} maxLength={100} autoComplete="name" onChange={(e) => setName(e.target.value)} />
                  </label>
                  <label><div>Email <span>(optional)</span></div>
                    <input type="email" value={email} maxLength={200} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
                  </label>
                </div>
                <label>Message
                  <textarea required rows={7} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)}
                    placeholder={kind === 'bug' ? 'What did you do, what did you expect, and what happened instead?' : 'Write your message here…'} />
                </label>
                <div className="contact__count">{message.length} / 4000</div>
                {/* Honeypot: hidden from people, tempting to bots. */}
                <input className="contact__trap" tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={(e) => setTrap(e.target.value)} name="website" />
                {error && <p className="contact__error" role="alert">{error}</p>}
                <button type="submit" className="contact__btn" disabled={busy || !message.trim()}>{busy ? 'Sending…' : 'Send message'}</button>
              </form>
            )}
          </section>

          <figure className="contact__me">
            <img src="/landing/lapalu.jpg" alt="Lapalu Liyanage playing acoustic guitar on stage at night" loading="lazy" />
            <figcaption>
              <b>Lapalu Liyanage</b>
              <span>Maker of Setsmith.</span>
            </figcaption>
          </figure>
        </div>
      </main>

      <PointerFx root={root} cards={CARDS} />
    </div>
  )
}
