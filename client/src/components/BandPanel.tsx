import { useState, type FormEvent } from 'react'
import type { Role } from '../lib/types'
import { newId, useStore } from '../state/store'

const ROLE_HELP: Record<Role, string> = {
  manager: 'Owns the band, edits everything, sends the PDF',
  editor: 'Can reorder, swap and change singers',
  viewer: 'Can see the setlist and open links',
}

export function BandPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [isSinger, setIsSinger] = useState(true)

  function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    dispatch({ type: 'addMember', member: { id: newId('m'), name: name.trim(), role, isSinger } })
    setName('')
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="band-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer__head">
          <h2 id="band-title">{state.bandName} members</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="drawer__body">
          <p className="muted">
            Sign-in and email invites arrive with the Supabase step. For now, add members here so you can assign singers.
          </p>
          <ul className="members">
            {state.members.map((m) => (
              <li key={m.id}>
                <input id={`member-name-${m.id}`} value={m.name} aria-label="Name"
                  onChange={(e) => dispatch({ type: 'updateMember', memberId: m.id, patch: { name: e.target.value } })} />
                <select id={`member-role-${m.id}`} value={m.role} aria-label="Role" title={ROLE_HELP[m.role]}
                  onChange={(e) => dispatch({ type: 'updateMember', memberId: m.id, patch: { role: e.target.value as Role } })}>
                  <option value="manager">Manager</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <label className="check">
                  <input id={`member-singer-${m.id}`} type="checkbox" checked={m.isSinger}
                    onChange={(e) => dispatch({ type: 'updateMember', memberId: m.id, patch: { isSinger: e.target.checked } })} />
                  Singer
                </label>
                <button className="btn btn--ghost" aria-label={`Remove ${m.name}`}
                  onClick={() => dispatch({ type: 'removeMember', memberId: m.id })}>✕</button>
              </li>
            ))}
          </ul>
          <form className="members__add" onSubmit={onAdd}>
            <input id="new-member-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="New member name" />
            <select id="new-member-role" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="New member role">
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
              <option value="manager">Manager</option>
            </select>
            <label className="check"><input id="new-member-singer" type="checkbox" checked={isSinger} onChange={(e) => setIsSinger(e.target.checked)} /> Singer</label>
            <button className="btn btn--primary" type="submit">Add</button>
          </form>
          <dl className="roles">
            {(Object.keys(ROLE_HELP) as Role[]).map((r) => <div key={r}><dt>{r}</dt><dd>{ROLE_HELP[r]}</dd></div>)}
          </dl>
        </div>
      </aside>
    </div>
  )
}
