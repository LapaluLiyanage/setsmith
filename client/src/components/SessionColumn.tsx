import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState } from 'react'
import { ARRANGE_LABELS, formatDuration, keyClashes, sessionDurationSec, singerOverload, type ArrangeMode } from '../lib/setlist'
import type { Member, Session, Song } from '../lib/types'
import { useStore } from '../state/store'
import { BpmSparkline } from './BpmSparkline'
import { SongRow } from './SongRow'

interface Props {
  session: Session
  songs: Record<string, Song>
  singers: Member[]
  swapId: string | null
  onSwapClick: (itemId: string) => void
  onAddSong: () => void
  onEditItem: (itemId: string) => void
}

export function SessionColumn({ session, songs, singers, swapId, onSwapClick, onAddSong, onEditItem }: Props) {
  const { dispatch } = useStore()
  const { setNodeRef, isOver } = useDroppable({ id: session.id })
  const [confirmDelete, setConfirmDelete] = useState(false)

  const totalSec = sessionDurationSec(session, songs)
  const targetSec = session.targetMinutes * 60
  const over = targetSec > 0 && totalSec > targetSec
  const fill = targetSec > 0 ? Math.min(100, (totalSec / targetSec) * 100) : 0
  const clashes = keyClashes(session.items, songs)
  const overloaded = singerOverload(session.items)

  return (
    <section className="session" aria-label={`Session ${session.name}`}>
      <header className="session__head">
        <input
          id={`session-name-${session.id}`}
          className="session__name"
          value={session.name}
          aria-label="Session name"
          onChange={(e) => dispatch({ type: 'updateSession', sessionId: session.id, patch: { name: e.target.value } })}
        />
        <div className="session__time">
          <span className={over ? 'is-over' : undefined}>{formatDuration(totalSec)}</span>
          <span className="muted">of</span>
          <input
            id={`session-target-${session.id}`}
            type="number"
            min={0}
            className="session__target"
            value={session.targetMinutes}
            aria-label="Target minutes"
            onChange={(e) => dispatch({ type: 'updateSession', sessionId: session.id, patch: { targetMinutes: Number(e.target.value) || 0 } })}
          />
          <span className="muted">min</span>
        </div>
        <div className={`meter${over ? ' meter--over' : ''}`}><span style={{ width: `${fill}%` }} /></div>
        {over && <p className="session__alert">Over by {formatDuration(totalSec - targetSec)}</p>}
        <div className="session__tools">
          <BpmSparkline values={session.items.map((i) => songs[i.songId]?.bpm ?? null)} />
          <select
            aria-label="Auto-arrange by BPM"
            value=""
            onChange={(e) => e.target.value && dispatch({ type: 'arrange', sessionId: session.id, mode: e.target.value as ArrangeMode })}
          >
            <option value="">Auto-arrange…</option>
            {Object.entries(ARRANGE_LABELS).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
          </select>
        </div>
      </header>

      <SortableContext items={session.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className={`session__list${isOver ? ' is-over' : ''}`}>
          {session.items.length === 0 && <li className="session__empty">Drop songs here or add one below</li>}
          {session.items.map((item, i) => {
            const song = songs[item.songId]
            if (!song) return null
            return (
              <SongRow
                key={item.id}
                item={item}
                song={song}
                position={i + 1}
                singers={singers}
                swapSelected={swapId === item.id}
                onSwapClick={() => onSwapClick(item.id)}
                onEdit={() => onEditItem(item.id)}
                keyClash={clashes.has(item.id)}
                singerOverload={overloaded.has(item.id)}
              />
            )
          })}
        </ol>
      </SortableContext>

      <footer className="session__foot">
        <button className="btn btn--ghost" onClick={onAddSong}>+ Add song</button>
        {confirmDelete ? (
          <span className="confirm">
            Delete session?
            <button className="btn btn--danger" onClick={() => dispatch({ type: 'deleteSession', sessionId: session.id })}>Delete</button>
            <button className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>Keep</button>
          </span>
        ) : (
          <button className="btn btn--ghost muted" onClick={() => setConfirmDelete(true)}>Delete session</button>
        )}
      </footer>
    </section>
  )
}
