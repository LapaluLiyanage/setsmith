import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../state/theme'
import './landing.css'
import './contact.css'

type Kind = 'suggestion' | 'question' | 'bug' | 'other'

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: 'suggestion', label: 'Suggestion', hint: 'An idea or something you wish Setsmith did.' },
  { id: 'question', label: 'Question', hint: 'Something you want to ask about Setsmith.' },
  { id: 'bug', label: 'Bug', hint: 'Something broke. Tell us what you did and what happened.' },
  { id: 'other', label: 'Other', hint: 'Anything else.' },
]

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

/** /contact: a suggestion box and contact form. Messages land in the Supabase `feedback` table. */
export default function Contact() {
  const [, toggleTheme] = useTheme()
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
    <div className="contact landing">
      <header className="contact__bar">
        <a href="/" className="contact__brand">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#1d1f22" /><g fill="#e2f24a" transform="translate(3,3)"><rect x="13" y="1" width="2" height="11" /><ellipse cx="11.5" cy="11" rx="3.5" ry="3" /><path d="M0 15h26l-4.2 6H4.2z" /><rect x="8" y="21" width="10" height="5" /></g></svg>
          <span>Setsmith</span>
        </a>
        <div style={{ flex: 1 }} />
        <button type="button" className="contact__icon" onClick={toggleTheme} aria-label="Toggle theme">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
        </button>
        <a href="/app" className="contact__cta">Open Setsmith →</a>
      </header>

      <main className="contact__main">
        <section className="contact__intro">
          <span className="contact__eyebrow">CONTACT &amp; SUGGESTIONS</span>
          <h1>Tell us what would make your shows easier.</h1>
          <p>Ideas, questions and bug reports all land in one inbox and get read. You don&rsquo;t need an account, and the email is optional unless you want a reply.</p>
          <figure className="contact__me">
            <img src="/landing/lapalu.jpg" alt="Lapalu Liyanage playing acoustic guitar on stage at night" loading="lazy" />
            <figcaption>
              <b>Lapalu Liyanage</b>
              <span>Maker of Setsmith.</span>
              <a href="mailto:lapaluliyanage@gmail.com">lapaluliyanage@gmail.com</a>
              <a href="tel:+94774680396">+94 77 468 0396</a>
              <a href="https://lapalu.me" target="_blank" rel="noopener noreferrer">Portfolio: lapalu.me ↗</a>
            </figcaption>
          </figure>
        </section>

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
      </main>
    </div>
  )
}
