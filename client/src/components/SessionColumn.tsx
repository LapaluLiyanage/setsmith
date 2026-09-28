import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Fragment, useEffect, useRef, useState } from 'react'
import { camelot, transposeKey } from '../lib/music'
import { formatDuration, keyClashes, sessionDurationSec, singerOverload, type ArrangeMode } from '../lib/setlist'
import { singerBadge } from '../lib/singers'
import type { Member, Session, Song } from '../lib/types'
import { useStore } from '../state/store'
import { BpmSparkline } from './BpmSparkline'
import { SongRow } from './SongRow'

const ARRANGE: [ArrangeMode, string, string][] = [
  ['build', 'Build up', 'Slowest first, steady climb'],
  ['mountain', 'Peak in the middle', 'Climb, hit the peak, land softly'],
  ['cooldown', 'Cool down', 'Fastest first, winding down'],
]

interface Props {
  session: Session
  index: number
  songs: Record<string, Song>
  members: Member[]
  /** Seconds into the show this session starts, for the rail clock. */
  startSec: number
  selectedId: string | null
  onTap: (itemId: string) => void
  onAddSong: () => void
  onEditItem: (itemId: string) => void
  notify: (message: string) => void
}

export function SessionColumn({ session, index, songs, members, startSec, selectedId, onTap, onAddSong, onEditItem, notify }: Props) {
  const { dispatch } = useStore()
  const { setNodeRef, isOver } = useDroppable({ id: session.id })
  const [arrangeOpen, setArrangeOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!arrangeOpen) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setArrangeOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [arrangeOpen])

  const totalSec = sessionDurationSec(session, songs)
  const targetSec = session.targetMinutes * 60
  const over = targetSec > 0 && totalSec > targetSec
  const clashes = keyClashes(session.items, songs)
  const overloaded = singerOverload(session.items)
  const label = /^encore$/i.test(session.name.trim()) ? 'EN' : `S${index + 1}`
  const count = `${session.items.length} song${session.items.length === 1 ? '' : 's'}`

  function warningFor(itemIndex: number): string | null {
    const item = session.items[itemIndex]
    if (overloaded.has(item.id)) {
      let run = 1
      for (let j = itemIndex; j > 0 && session.items[j - 1].singerId === item.singerId; j--) run++
      return `${singerBadge(members, item.singerId).name} sings ${run} in a row`
    }
    if (clashes.has(item.id)) {
      const a = session.items[itemIndex - 1]
      const ka = songs[a.songId].key!, kb = songs[item.songId].key!
      return `Key jump ${camelot(transposeKey(ka, a.transpose))} → ${camelot(transposeKey(kb, item.transpose))}`
    }
    return null
  }

  return (
    <section className={`session${collapsed ? ' session--collapsed' : ''}`} aria-label={`Session ${session.name}`}>
      <div className="session__rail">
        <span className="session__badge">{label}</span>
        <span className="session__clock mono">{formatDuration(startSec)} → {formatDuration(startSec + totalSec)}</span>
      </div>

      <div className="session__card">
        <div className="session__top">
          <button className="session__toggle icon-btn" aria-expanded={!collapsed} aria-label={collapsed ? 'Show songs' : 'Hide songs'}
            onClick={() => setCollapsed((c) => !c)}>{collapsed ? '▸' : '▾'}</button>
          <div className="session__title">
            <input id={`session-name-${session.id}`} className="session__name" value={session.name} aria-label="Session name"
              onChange={(e) => dispatch({ type: 'updateSession', sessionId: session.id, patch: { name: e.target.value } })} />
            <span className="session__sub">
              {count} · target
              <input id={`session-target-${session.id}`} type="number" min={0} className="session__target mono" value={session.targetMinutes}
                aria-label="Target minutes"
                onChange={(e) => dispatch({ type: 'updateSession', sessionId: session.id, patch: { targetMinutes: Number(e.target.value) || 0 } })} />
              min
            </span>
          </div>
          <div className="menu-wrap" ref={menuRef}>
            <button className="pill" aria-haspopup="menu" aria-expanded={arrangeOpen} onClick={() => setArrangeOpen((o) => !o)}>Auto-arrange ▾</button>
            {arrangeOpen && (
              <div className="menu" role="menu">
                {ARRANGE.map(([mode, title, desc]) => (
                  <button key={mode} role="menuitem" className="menu__item" onClick={() => {
                    setArrangeOpen(false)
                    dispatch({ type: 'arrange', sessionId: session.id, mode })
                    notify(`${session.name} arranged · ${title}`)
                  }}>
                    <b>{title}</b><span>{desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <BpmSparkline values={session.items.map((i) => songs[i.songId]?.bpm ?? null)} />

        <div>
          <div className="progress__text">
            <span><b className="mono">{formatDuration(totalSec)}</b><span className="muted mono"> / {formatDuration(targetSec)}</span></span>
            {over
              ? <span className="progress__over mono">+{formatDuration(totalSec - targetSec)} over</span>
              : <span className="muted mono">{formatDuration(Math.max(0, targetSec - totalSec))} left</span>}
          </div>
          <div className={`progress${over ? ' progress--over' : ''}`}>
            <i style={{ width: `${targetSec ? Math.min(100, (totalSec / targetSec) * 100) : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="session__body">
        <SortableContext items={session.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ol ref={setNodeRef} className={`songs${isOver ? ' is-over' : ''}`}>
            {session.items.length === 0 && (
              <li className="songs__empty">No songs in {session.name} yet — add one or drag it here.</li>
            )}
            {session.items.map((item, i) => {
              const song = songs[item.songId]
              if (!song) return null
              const warning = i > 0 ? warningFor(i) : null
              return (
                <Fragment key={item.id}>
                  {warning && <li className="warn" role="note"><b>!</b>{warning}</li>}
                  <SongRow
                    item={item}
                    song={song}
                    position={i + 1}
                    members={members}
                    selected={selectedId === item.id}
                    onTap={() => onTap(item.id)}
                    onEdit={() => onEditItem(item.id)}
                    onSinger={(singerId) => {
                      dispatch({ type: 'updateItem', itemId: item.id, patch: { singerId } })
                      notify(singerId ? `${singerBadge(members, singerId).name} now sings “${song.title}”` : `“${song.title}” has no singer`)
                    }}
                  />
                </Fragment>
              )
            })}
          </ol>
        </SortableContext>
        <div className="session__foot" style={{ marginTop: 6, flexDirection: 'column', gap: 6 }}>
          <button className="add-song" onClick={onAddSong}><i>+</i>Add song</button>
          {confirmDelete ? (
            <span className="confirm" style={{ justifyContent: 'center' }}>
              Delete {session.name} and its {count}?
              <button className="pill pill--danger" onClick={() => dispatch({ type: 'deleteSession', sessionId: session.id })}>Delete</button>
              <button className="pill pill--ghost" onClick={() => setConfirmDelete(false)}>Keep</button>
            </span>
          ) : (
            <button className="pill pill--ghost" style={{ alignSelf: 'center' }} onClick={() => setConfirmDelete(true)}>Delete session</button>
          )}
        </div>
      </div>
    </section>
  )
}
