import { Capacitor } from '@capacitor/core'
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../state/store'

type Mode = 'signin' | 'signup' | 'magic'

const TITLES: Record<Mode, string> = { signin: 'Sign in', signup: 'Create account', magic: 'Email me a link' }

/** Where Supabase sends people back to after an email link or Google sign-in (the landing page lives at /). */
const APP_URL = `${window.location.origin}/app`

/** Google "G" in its four brand colours. */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden style={{ flex: 'none' }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setMessage({ ok: false, text: error.message })
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: APP_URL } })
        if (error) setMessage({ ok: false, text: error.message })
        else if (!data.session) setMessage({ ok: true, text: 'Check your inbox and confirm your email, then sign in.' })
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: APP_URL } })
        setMessage(error ? { ok: false, text: error.message } : { ok: true, text: 'Link sent. Open it on this device to sign in.' })
      }
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: APP_URL } })
    if (error) {
      setMessage({ ok: false, text: error.message })
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={submit}>
        <span className="eyebrow">Setsmith</span>
        <h1>{TITLES[mode]}</h1>
        <p className="muted">Sign in to keep your band’s setlists in sync across phones and laptops, and to share access.</p>
        <p className="gate__note">
          Only the person managing setlists needs an account. Editors and viewers who get an invite link
          never see this screen at all — they land straight in the band, no sign-in required.
        </p>
        {!Capacitor.isNativePlatform() && (
          <>
            <button type="button" className="pill pill--lg" onClick={google} disabled={busy}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <GoogleLogo />
              Continue with Google
            </button>
            <p className="muted" style={{ textAlign: 'center', margin: 0 }}>or use your email</p>
          </>
        )}
        <div className="gate__tabs" role="tablist">
          {(Object.keys(TITLES) as Mode[]).map((m) => (
            <button type="button" key={m} role="tab" aria-selected={mode === m} className={'lf__preset' + (mode === m ? ' is-on' : '')}
              onClick={() => { setMode(m); setMessage(null) }}>{m === 'signin' ? 'Sign in' : m === 'signup' ? 'Sign up' : 'Magic link'}</button>
          ))}
        </div>
        <label className="gate__field">Email
          <input type="email" id="auth-email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'magic' && (
          <label className="gate__field">Password
            <input type="password" id="auth-password" required minLength={6} value={password}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {message && <p className={'gate__msg' + (message.ok ? ' is-ok' : '')} role="status">{message.text}</p>}
        <button className="pill pill--accent pill--lg" type="submit" disabled={busy}>{busy ? 'Working…' : TITLES[mode]}</button>
      </form>
    </div>
  )
}

export function OnboardScreen() {
  const { state, cloud } = useStore()
  const [name, setName] = useState(state.bandName)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    const err = await fn()
    if (err) setError(err)
    setBusy(false)
  }

  return (
    <div className="gate">
      <div className="gate__card">
        <span className="eyebrow">{cloud.isAnonymous ? 'Joined without an account' : `Signed in as ${cloud.email}`}</span>
        <h1>{cloud.isAnonymous ? 'That invite link didn\'t work' : 'Set up your band'}</h1>
        {cloud.isAnonymous && (
          <p className="muted">It may have expired or already been used. Ask your band manager for a fresh one, or paste a code below.</p>
        )}
        {!cloud.isAnonymous && (
          <form className="gate__section" onSubmit={(e) => { e.preventDefault(); run(() => cloud.createBand(name)) }}>
            <h2>Start a band</h2>
            <p className="muted">You become the manager, with a blank setlist to start filling in.</p>
            <label className="gate__field">Band name
              <input id="onboard-band" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <button className="pill pill--accent" type="submit" disabled={busy}>Create band</button>
          </form>
        )}
        <form className="gate__section" onSubmit={(e) => { e.preventDefault(); run(() => cloud.joinWithCode(code)) }}>
          <h2>Join a band</h2>
          <p className="muted">Paste the invite link or code your manager sent you.</p>
          <label className="gate__field">Invite link or code
            <input id="onboard-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <button className="pill" type="submit" disabled={busy}>Join</button>
        </form>
        {error && <p className="gate__msg" role="alert">{error}</p>}
        <button className="gate__skip" onClick={cloud.signOut}>{cloud.isAnonymous ? 'Start over' : 'Sign out'}</button>
      </div>
    </div>
  )
}

export function JoinScreen() {
  const { cloud } = useStore()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await cloud.joinAnonymously(name)
    if (err) { setError(err); setBusy(false) }
    // On success the app signs itself in and redeems the invite automatically; this screen unmounts.
  }

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={submit}>
        <span className="eyebrow">Setsmith</span>
        <h1>Join the band</h1>
        <p className="muted">
          You've been invited. No account needed — just tell the band who you are, and you'll land straight
          in the setlist.
        </p>
        <label className="gate__field">Your name
          <input id="join-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kasun" />
        </label>
        {error && <p className="gate__msg" role="alert">{error}</p>}
        <button className="pill pill--accent pill--lg" type="submit" disabled={busy}>{busy ? 'Joining…' : 'Join'}</button>
      </form>
    </div>
  )
}

export function LoadingScreen() {
  return <div className="gate"><p className="muted" role="status">Loading your band…</p></div>
}

export function UnconfiguredScreen() {
  return (
    <div className="gate">
      <div className="gate__card">
        <span className="eyebrow">Setsmith</span>
        <h1>Cloud not set up</h1>
        <p className="muted">
          This deployment is missing its Supabase configuration (VITE_SUPABASE_URL / VITE_SUPABASE_KEY),
          so there's nowhere to sign in to. Ask whoever manages this deployment to set it up.
        </p>
      </div>
    </div>
  )
}
