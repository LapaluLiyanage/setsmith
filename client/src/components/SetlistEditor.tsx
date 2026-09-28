import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useState } from 'react'
import { findItem, formatDuration, moveItem, sessionDurationSec } from '../lib/setlist'
import type { Session, Show } from '../lib/types'
import { newId, useStore } from '../state/store'
import { SessionColumn } from './SessionColumn'
import { SongDrawer } from './SongDrawer'

type DrawerState = { mode: 'add'; sessionId: string } | { mode: 'edit'; itemId: string } | null

export function SetlistEditor({ show }: { show: Show }) {
  const { state, dispatch } = useStore()
  const singers = state.members.filter((m) => m.isSinger)

  // While dragging, a working copy of the sessions shows cross-session moves live;
  // it's committed as one undo step when the drag ends.
  const [dragSessions, setDragSessions] = useState<Session[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [swapId, setSwapId] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const sessions = dragSessions ?? show.sessions

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSwapId(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function locate(list: Session[], id: string): { sessionIndex: number; index: number } | null {
    const s = list.findIndex((x) => x.id === id)
    if (s !== -1) return { sessionIndex: s, index: list[s].items.length }
    const loc = findItem(list, id)
    return loc && { sessionIndex: loc.sessionIndex, index: loc.itemIndex }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
    setDragSessions(show.sessions)
    setSwapId(null)
  }

  function onDragOver(e: DragOverEvent) {
    if (!e.over || !dragSessions) return
    const from = findItem(dragSessions, String(e.active.id))
    const to = locate(dragSessions, String(e.over.id))
    if (!from || !to || from.sessionIndex === to.sessionIndex) return
    setDragSessions(moveItem(dragSessions, String(e.active.id), dragSessions[to.sessionIndex].id, to.index))
  }

  function onDragEnd(e: DragEndEvent) {
    let final = dragSessions ?? show.sessions
    if (e.over) {
      const from = findItem(final, String(e.active.id))
      const to = locate(final, String(e.over.id))
      if (from && to && from.sessionIndex === to.sessionIndex && from.itemIndex !== to.index) {
        final = moveItem(final, String(e.active.id), final[to.sessionIndex].id, to.index)
      }
    }
    if (final !== show.sessions) dispatch({ type: 'setSessions', showId: show.id, sessions: final })
    setDragSessions(null)
    setActiveId(null)
  }

  function onDragCancel() {
    setDragSessions(null)
    setActiveId(null)
  }

  function onSwapClick(itemId: string) {
    if (!swapId) return setSwapId(itemId)
    if (swapId !== itemId) dispatch({ type: 'swapItems', aId: swapId, bId: itemId })
    setSwapId(null)
  }

  const totalSec = show.sessions.reduce((sum, s) => sum + sessionDurationSec(s, state.songs), 0)
  const songCount = show.sessions.reduce((n, s) => n + s.items.length, 0)
  const activeLoc = activeId ? findItem(sessions, activeId) : null
  const activeSong = activeLoc ? state.songs[sessions[activeLoc.sessionIndex].items[activeLoc.itemIndex].songId] : null

  const drawerTarget = (() => {
    if (!drawer) return null
    if (drawer.mode === 'add') return drawer
    const loc = findItem(show.sessions, drawer.itemId)
    if (!loc) return null
    const item = show.sessions[loc.sessionIndex].items[loc.itemIndex]
    return { mode: 'edit' as const, item, song: state.songs[item.songId] }
  })()

  return (
    <>
      <section className="show-head">
        <div className="show-head__fields">
          <input id="show-name" className="show-head__name" value={show.name} aria-label="Show name"
            onChange={(e) => dispatch({ type: 'updateShow', showId: show.id, patch: { name: e.target.value } })} />
          <div className="show-head__meta">
            <label><span>Date</span><input id="show-date" type="date" value={show.date}
              onChange={(e) => dispatch({ type: 'updateShow', showId: show.id, patch: { date: e.target.value } })} /></label>
            <label><span>Venue</span><input id="show-venue" value={show.venue}
              onChange={(e) => dispatch({ type: 'updateShow', showId: show.id, patch: { venue: e.target.value } })} /></label>
            <label><span>Booked slot (min)</span><input id="show-slot" type="number" min={0} value={show.slotMinutes}
              onChange={(e) => dispatch({ type: 'updateShow', showId: show.id, patch: { slotMinutes: Number(e.target.value) || 0 } })} /></label>
          </div>
        </div>
        <dl className="show-head__stats">
          <div><dt>Songs</dt><dd>{songCount}</dd></div>
          <div><dt>Planned</dt><dd className={totalSec > show.slotMinutes * 60 ? 'is-over' : undefined}>{formatDuration(totalSec)}</dd></div>
          <div><dt>Slot</dt><dd>{formatDuration(show.slotMinutes * 60)}</dd></div>
        </dl>
      </section>

      {swapId && (
        <p className="swap-hint" role="status">
          Quick swap: now press ⇄ on the song to swap with. <button className="btn btn--ghost" onClick={() => setSwapId(null)}>Cancel</button>
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <div className="board">
          {sessions.map((session) => (
            <SessionColumn
              key={session.id}
              session={session}
              songs={state.songs}
              singers={singers}
              swapId={swapId}
              onSwapClick={onSwapClick}
              onAddSong={() => setDrawer({ mode: 'add', sessionId: session.id })}
              onEditItem={(itemId) => setDrawer({ mode: 'edit', itemId })}
            />
          ))}
          <button className="board__add" onClick={() => dispatch({
            type: 'addSession', showId: show.id,
            session: { id: newId('sess'), name: `Session ${show.sessions.length + 1}`, targetMinutes: 45, items: [] },
          })}>
            + Add session
          </button>
        </div>
        <DragOverlay>
          {activeSong && <div className="drag-ghost"><strong>{activeSong.title}</strong> <span>{activeSong.bpm ?? '—'} BPM</span></div>}
        </DragOverlay>
      </DndContext>

      {drawerTarget && <SongDrawer key={JSON.stringify(drawer)} target={drawerTarget} singers={singers} onClose={() => setDrawer(null)} />}
    </>
  )
}
