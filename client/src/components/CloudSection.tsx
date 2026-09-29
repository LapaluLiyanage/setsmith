import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Role, Show } from '../lib/types'
import { useStore } from '../state/store'

const STATUS_TEXT = { saving: 'Saving…', saved: 'All changes saved', error: 'Save problem' } as const

const link = (param: string, value: string) => `${window.location.origin}${window.location.pathname}?${param}=${value}`

export function CloudSection({ show }: { show: Show | null }) {
  const { cloud } = useStore()
  const [inviteRole, setInviteRole] = useState<Exclude<Role, 'manager'>>('editor')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [groupCode, setGroupCode] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const isManager = cloud.role === 'manager'
  const bandId = cloud.band?.id
  const showId = show?.id

  useEffect(() => {
    setShareToken(null)
    if (!supabase || !bandId || !showId || !isManager) return
    let cancelled = false
    supabase.from('shares').select('token').eq('band_id', bandId).eq('show_id', showId).maybeSingle()
      .then(({ data }) => !cancelled && setShareToken((data?.token as string | undefined) ?? null))
    return () => { cancelled = true }
  }, [bandId, showId, isManager])

  useEffect(() => {
    setGroupCode(null)
    if (!supabase || !bandId || !isManager) return
    let cancelled = false
    supabase.from('invites').select('code').eq('band_id', bandId).eq('role', 'viewer').eq('reusable', true).maybeSingle()
      .then(({ data }) => !cancelled && setGroupCode((data?.code as string | undefined) ?? null))
    return () => { cancelled = true }
  }, [bandId, isManager])

  if (!cloud.configured || cloud.gate !== 'app' || !cloud.band) return null

  const band = cloud.band

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMsg(`${label} copied.`)
    } catch {
      setMsg(text)
    }
  }

  async function createInvite() {
    if (!supabase || !cloud.userId) return
    const { data, error } = await supabase.from('invites').insert({ band_id: band.id, role: inviteRole }).select('code').single()
    if (error) return setMsg(error.message)
    const url = link('invite', data.code as string)
    setInviteUrl(url)
    copy(url, 'Invite link')
  }

  async function createGroupLink() {
    if (!supabase) return
    const { data, error } = await supabase.from('invites')
      .insert({ band_id: band.id, role: 'viewer', reusable: true, expires_at: new Date(Date.now() + 365 * 86400_000).toISOString() })
      .select('code').single()
    if (error) return setMsg(error.message)
    setGroupCode(data.code as string)
    copy(link('invite', data.code as string), 'Group viewer link')
  }

  async function revokeGroupLink() {
    if (!supabase || !groupCode) return
    const { error } = await supabase.from('invites').delete().eq('code', groupCode)
    if (error) return setMsg(error.message)
    setGroupCode(null)
    setMsg('Group viewer link turned off.')
  }

  async function createShare() {
    if (!supabase || !show) return
    const { data, error } = await supabase.from('shares').insert({ band_id: band.id, show_id: show.id }).select('token').single()
    if (error) return setMsg(error.message)
    setShareToken(data.token as string)
    copy(link('share', data.token as string), 'Share link')
  }

  async function revokeShare() {
    if (!supabase || !shareToken) return
    const { error } = await supabase.from('shares').delete().eq('token', shareToken)
    if (error) return setMsg(error.message)
    setShareToken(null)
    setMsg('Share link turned off.')
  }

  async function setRole(userId: string, role: Role) {
    if (!supabase) return
    const { error } = await supabase.from('band_access').update({ role }).eq('band_id', band.id).eq('user_id', userId)
    if (error) setMsg(error.message)
    cloud.refreshAccess()
  }

  async function remove(userId: string) {
    if (!supabase) return
    const { error } = await supabase.from('band_access').delete().eq('band_id', band.id).eq('user_id', userId)
    if (error) setMsg(error.message)
    cloud.refreshAccess()
  }

  return (
    <section className="cloud">
      <h3>Sync &amp; access</h3>
      <p className="cloud__row">
        <span className={'sync-dot sync-dot--' + cloud.status} aria-hidden /> {STATUS_TEXT[cloud.status]} · signed in as {cloud.email} · you are {band.role}
      </p>
      {cloud.bands.length > 1 && (
        <label className="check">Band
          <select id="band-switch" value={band.id} onChange={(e) => cloud.switchBand(e.target.value)}>
            {cloud.bands.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.role})</option>)}
          </select>
        </label>
      )}

      <h4>People with access</h4>
      <ul className="members">
        {cloud.access.map((a) => {
          const me = a.userId === cloud.userId
          return (
            <li key={a.userId} className="member">
              <span className="cloud__name">{a.displayName || 'Member'}{me ? ' (you)' : ''}</span>
              {isManager && !me ? (
                <select value={a.role} aria-label={`Role for ${a.displayName}`} onChange={(e) => setRole(a.userId, e.target.value as Role)}>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : <span className="muted">{a.role}</span>}
              {isManager && !me && <button className="icon-btn" aria-label={`Remove ${a.displayName}`} onClick={() => remove(a.userId)}>✕</button>}
            </li>
          )
        })}
      </ul>

      {isManager && (
        <>
          <h4>Invite someone</h4>
          <div className="member">
            <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Exclude<Role, 'manager'>)} aria-label="Invite role">
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="pill pill--accent" onClick={createInvite}>Create invite link</button>
          </div>
          {inviteUrl && <input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} aria-label="Invite link" />}
          <p className="muted" style={{ fontSize: 13 }}>
            One person, 14 days. No account needed — they open the link, type their name, and land in this band.
          </p>

          <h4>Group viewer link</h4>
          {groupCode ? (
            <>
              <input readOnly value={link('invite', groupCode)} onFocus={(e) => e.target.select()} aria-label="Group viewer link" />
              <div className="member">
                <button className="pill" onClick={() => copy(link('invite', groupCode), 'Group viewer link')}>Copy</button>
                <button className="pill" onClick={revokeGroupLink}>Turn off</button>
              </div>
            </>
          ) : (
            <button className="pill" onClick={createGroupLink}>Create group viewer link</button>
          )}
          <p className="muted" style={{ fontSize: 13 }}>
            One link for the whole band — anyone who opens it joins as a viewer (name only, no account),
            and it keeps working for the next person too. Turn it off any time.
          </p>

          <h4>Public link{show ? ` for “${show.name}”` : ''}</h4>
          {shareToken ? (
            <>
              <input readOnly value={link('share', shareToken)} onFocus={(e) => e.target.select()} aria-label="Share link" />
              <div className="member">
                <button className="pill" onClick={() => copy(link('share', shareToken), 'Share link')}>Copy</button>
                <button className="pill" onClick={revokeShare}>Turn off</button>
              </div>
            </>
          ) : (
            <button className="pill" disabled={!show} onClick={createShare}>Create read-only link</button>
          )}
          <p className="muted" style={{ fontSize: 13 }}>
            Anyone with the link sees this show’s setlist without an account — and if you use Stage view
            here, their screen follows the current song live, no sign-in needed.
          </p>
        </>
      )}

      {msg && <p className="status" role="status">{msg}</p>}
      <div className="member">
        <button className="pill" onClick={cloud.signOut}>Sign out</button>
      </div>
    </section>
  )
}
