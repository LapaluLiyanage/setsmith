import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../state/store'

type Mode = 'signin' | 'signup' | 'magic'

const TITLES: Record<Mode, string> = { signin: 'Sign in', signup: 'Create account', magic: 'Email me a link' }

export function AuthScreen() {
  const { cloud } = useStore()
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
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        if (error) setMessage({ ok: false, text: error.message })
        else if (!data.session) setMessage({ ok: true, text: 'Check your inbox and confirm your email, then sign in.' })
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
        setMessage(error ? { ok: false, text: error.message } : { ok: true, text: 'Link sent. Open it on this device to sign in.' })
      }
    } finally {
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
          Only the person managing setlists needs an account. Other players don’t sign in at all —
          the manager sends them a link (Band → Public link) that opens straight to the live setlist and
          current song, no login required.
        </p>
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
        <button className="gate__skip" type="button" onClick={cloud.goLocal}>
          Or skip sign-in and work solo (no sync, no sharing — data stays only on this device)
        </button>
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
        <span className="eyebrow">Signed in as {cloud.email}</span>
        <h1>Set up your band</h1>
        <form className="gate__section" onSubmit={(e) => { e.preventDefault(); run(() => cloud.createBand(name)) }}>
          <h2>Start a band</h2>
          <p className="muted">You become the manager. Your current setlists and songs on this device are uploaded as the starting point.</p>
          <label className="gate__field">Band name
            <input id="onboard-band" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <button className="pill pill--accent" type="submit" disabled={busy}>Create band</button>
        </form>
        <form className="gate__section" onSubmit={(e) => { e.preventDefault(); run(() => cloud.joinWithCode(code)) }}>
          <h2>Join a band</h2>
          <p className="muted">Paste the invite link or code your manager sent you.</p>
          <label className="gate__field">Invite link or code
            <input id="onboard-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <button className="pill" type="submit" disabled={busy}>Join</button>
        </form>
        {error && <p className="gate__msg" role="alert">{error}</p>}
        <button className="gate__skip" onClick={cloud.goLocal}>Use locally for now</button>
        <button className="gate__skip" onClick={cloud.signOut}>Sign out</button>
      </div>
    </div>
  )
}

export function LoadingScreen() {
  return <div className="gate"><p className="muted" role="status">Loading your band…</p></div>
}
