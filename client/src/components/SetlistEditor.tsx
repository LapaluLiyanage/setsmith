import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { gsap } from 'gsap'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { reducedMotion } from '../lib/motion'
import { findItem, formatDuration, keyClashes, moveItem, sessionDurationSec } from '../lib/setlist'
import type { Session, Show } from '../lib/types'
import { loadYouTubeApi } from '../lib/ytPlayer'
import { newId, useStore } from '../state/store'
import type { Theme } from '../state/theme'
import { EnergyMap } from './EnergyMap'
import { SessionColumn } from './SessionColumn'
import { SongDrawer } from './SongDrawer'

type DrawerState = { mode: 'add'; sessionId: string } | { mode: 'edit'; itemId: string } | null

interface Props {
  show: Show
  theme: Theme
  onShare: () => void
  onExport: () => void
  onStage: () => void
}

const TOAST_MS = 6000

function showDateLine(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 'NO DATE'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, '').toUpperCase()
}

export function SetlistEditor({ show, theme, onShare, onExport, onStage }: Props) {
  const { state, dispatch, canUndo, cloud } = useStore()
  const members = state.members

  // While dragging, a working copy shows cross-session moves live; it's committed as one undo step on drop.
  const [dragSessions, setDragSessions] = useState<Session[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [toast, setToast] = useState<{ msg: string; n: number } | null>(null)
  const sessions = dragSessions ?? show.sessions

  const boardRef = useRef<HTMLDivElement>(null)
  const toastRef = useRef<HTMLDivElement>(null)
  const rectsRef = useRef(new Map<string, { x: number; y: number }>())
  const skipFlip = useRef(false)

  const notify = useCallback((msg: string) => setToast((t) => ({ msg, n: (t?.n ?? 0) + 1 })), [])

  // Preload the YouTube player script so the first tap of a row's play button actually
  // autoplays instead of needing a second tap once the script has caught up.
  useEffect(() => { loadYouTubeApi() }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])

  // Toast / swap banner pops in.
  useLayoutEffect(() => {
    if (toastRef.current && !reducedMotion()) {
      gsap.fromTo(toastRef.current, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(2)' })
    }
  }, [toast?.n, selectedId])

  // Song cards rise in on first load.
  useLayoutEffect(() => {
    if (reducedMotion() || !boardRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-sid]', { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.035, delay: 0.1, clearProps: 'transform,opacity' })
    }, boardRef)
    return () => ctx.revert()
  }, [])

  // FLIP: when the order changes (swap, arrange, undo, add/remove), glide cards from where they were.
  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return
    const base = board.getBoundingClientRect()
    const next = new Map<string, { x: number; y: number }>()
    const cards = board.querySelectorAll<HTMLElement>('[data-sid]')
    cards.forEach((el) => {
      const r = el.getBoundingClientRect()
      next.set(el.dataset.sid!, { x: r.left - base.left, y: r.top - base.top })
    })
    const prev = rectsRef.current
    if (!skipFlip.current && prev.size && !reducedMotion()) {
      cards.forEach((el) => {
        const from = prev.get(el.dataset.sid!)
        const to = next.get(el.dataset.sid!)
        if (!from || !to) return
        const dx = from.x - to.x
        const dy = from.y - to.y
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
        gsap.fromTo(el, { x: dx, y: dy, zIndex: 10 }, { x: 0, y: 0, duration: 0.55, ease: 'power3.inOut', clearProps: 'transform,zIndex' })
      })
    }
    skipFlip.current = false
    rectsRef.current = next
  }, [show.sessions])

  // Sensor hooks must run unconditionally every render; whether they actually activate drag is
  // decided below instead. Viewers can't persist a drag anyway (the save is rejected server-side),
  // which without this guard shows as "picks up, drops, then snaps back" -- so drag never starts.
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  const sensors = useSensors(...(cloud.readOnly ? [] : [pointerSensor, touchSensor, keyboardSensor]))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelectedId(null); setPlayingId(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function locate(list: Session[], id: string) {
    const s = list.findIndex((x) => x.id === id)
    if (s !== -1) return { sessionIndex: s, index: list[s].items.length }
    const loc = findItem(list, id)
    return loc && { sessionIndex: loc.sessionIndex, index: loc.itemIndex }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
    setDragSessions(show.sessions)
    setSelectedId(null)
    setPlayingId(null)
    setToast(null)
  }

  function onDragOver(e: DragOverEvent) {
    if (!e.over || !dragSessions) return
    const from = findItem(dragSessions, String(e.active.id))
    const to = locate(dragSessions, String(e.over.id))
    if (!from || !to || from.sessionIndex === to.sessionIndex) return
    setDragSessions(moveItem(dragSessions, String(e.active.id), dragSessions[to.sessionIndex].id, to.index))
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id)
    let final = dragSessions ?? show.sessions
    if (e.over) {
      const from = findItem(final, id)
      const to = locate(final, String(e.over.id))
      if (from && to && from.sessionIndex === to.sessionIndex && from.itemIndex !== to.index) {
        final = moveItem(final, id, final[to.sessionIndex].id, to.index)
      }
    }
    const before = findItem(show.sessions, id)
    const after = findItem(final, id)
    if (final !== show.sessions && after && (before?.sessionIndex !== after.sessionIndex || before?.itemIndex !== after.itemIndex)) {
      skipFlip.current = true // dnd-kit already animated the drop
      dispatch({ type: 'setSessions', showId: show.id, sessions: final })
      const item = final[after.sessionIndex].items[after.itemIndex]
      notify(`Moved “${state.songs[item.songId]?.title}” to ${final[after.sessionIndex].name}, position ${after.itemIndex + 1}`)
    }
    setDragSessions(null)
    setActiveId(null)
  }

  function onDragCancel() {
    setDragSessions(null)
    setActiveId(null)
  }

  function onTap(itemId: string) {
    if (cloud.readOnly) return
    if (!selectedId) { setSelectedId(itemId); setToast(null); return }
    if (selectedId === itemId) { setSelectedId(null); return }
    const a = findItem(show.sessions, selectedId)
    const b = findItem(show.sessions, itemId)
    dispatch({ type: 'swapItems', aId: selectedId, bId: itemId })
    setSelectedId(null)
    if (a && b) {
      const ta = state.songs[show.sessions[a.sessionIndex].items[a.itemIndex].songId]?.title
      const tb = state.songs[show.sessions[b.sessionIndex].items[b.itemIndex].songId]?.title
      notify(`Swapped “${ta}” ↔ “${tb}”`)
    }
  }

  function undo() {
    dispatch({ type: 'undo' })
    setToast(null)
  }

  // Numbers for the stats card and dock.
  const allItems = show.sessions.flatMap((s) => s.items)
  const totalSec = show.sessions.reduce((sum, s) => sum + sessionDurationSec(s, state.songs), 0)
  const bpms = allItems.map((i) => state.songs[i.songId]?.bpm).filter((b): b is number => b != null)
  const avgBpm = bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : null
  const clashCount = show.sessions.reduce((n, s) => n + keyClashes(s.items, state.songs).size, 0)
  const slotSec = show.slotMinutes * 60
  const gaps = allItems.some((i) => {
    const s = state.songs[i.songId]
    return !s?.youtubeId || !s.bpm || !s.key || !i.singerId
  })
  const status = totalSec > slotSec ? 'Over slot' : gaps || allItems.length === 0 ? 'Draft' : 'Ready'
  const singerCount = new Set(allItems.map((i) => i.singerId).filter(Boolean)).size
  const selLoc = selectedId ? findItem(show.sessions, selectedId) : null
  const selectedTitle = selLoc ? state.songs[show.sessions[selLoc.sessionIndex].items[selLoc.itemIndex].songId]?.title : null

  let running = 0
  const starts = sessions.map((s) => { const at = running; running += sessionDurationSec(s, state.songs); return at })

  const activeLoc = activeId ? findItem(sessions, activeId) : null
  const activeSong = activeLoc ? state.songs[sessions[activeLoc.sessionIndex].items[activeLoc.itemIndex].songId] : null

  const drawerTarget = (() => {
    if (!drawer) return null
    if (drawer.mode === 'add') {
      const s = show.sessions.find((x) => x.id === drawer.sessionId)
      return s ? { mode: 'add' as const, sessionId: s.id, sessionName: s.name } : null
    }
    const loc = findItem(show.sessions, drawer.itemId)
    if (!loc) return null
    const item = show.sessions[loc.sessionIndex].items[loc.itemIndex]
    return { mode: 'edit' as const, item, song: state.songs[item.songId], sessionName: show.sessions[loc.sessionIndex].name }
  })()

  return (
    <>
      <div className="overview">
        <section className="card show-card" aria-label="Show details">
          <div className="show-card__meta">
            <span className="eyebrow">{showDateLine(show.date)}</span>
            <span className="chip" style={status === 'Over slot' ? { background: 'var(--wr)', color: '#fff' } : undefined}>{status}</span>
          </div>
          <textarea id="show-name" className="show-card__title" rows={1} value={show.name} aria-label="Show name"
            onChange={(e) => dispatch({ type: 'updateShow', showId: show.id, patch: { name: e.target.value } })} />
          <span className="muted" style={{ fontSize: 14 }}>
            {[show.venue, state.bandName, `${singerCount} singer${singerCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
          </span>
          <div className="show-card__row">
            <input id="show-date" type="date" value={show.date} aria-label="Show date"
              onChange={(e) => dispatch({ type: 'updateShow', showId: show.id, patch: { date: e.target.value } })} />
            <input id="show-venue" value={show.venue} placeholder="Venue" aria-label="Venue"
              onChange={(e) => dispatch({ type: 'updateShow', showId: show.id, patch: { venue: e.target.value } })} />
          </div>
        </section>

        <section className="card stats" aria-label="Show numbers">
          <div className="stats__grid">
            <label className="stat">
              <span className="stat__label">Booked slot (min)</span>
              <input id="show-slot" type="number" min={0} className="stat__value" value={show.slotMinutes}
                style={{ height: 'auto', padding: 0, border: 0, background: 'transparent', width: '4ch' }}
                onChange={(e) => dispatch({ type: 'updateShow', showId: show.id, patch: { slotMinutes: Number(e.target.value) || 0 } })} />
            </label>
            <div className="stat"><span className="stat__label">Planned</span>
              <span className={`stat__value${totalSec > slotSec ? ' stat__value--warn' : ''}`}>{formatDuration(totalSec)}</span></div>
            <div className="stat"><span className="stat__label">Avg tempo</span>
              <span className="stat__value">{avgBpm ?? '—'}<small> bpm</small></span></div>
            <div className="stat"><span className="stat__label">Key clashes</span>
              <span className={`stat__value${clashCount ? ' stat__value--warn' : ''}`}>{clashCount}</span></div>
          </div>
          <div className="stats__actions">
            <button className="pill" onClick={onShare}>Share</button>
            <button className="pill" onClick={onExport}>Preview PDF</button>
            <span className="pill pill--ghost">{allItems.length} songs</span>
          </div>
        </section>

        <EnergyMap sessions={sessions} songs={state.songs} theme={theme} />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <div className="board" ref={boardRef}>
          {sessions.map((session, i) => (
            <SessionColumn
              key={session.id}
              session={session}
              index={i}
              songs={state.songs}
              members={members}
              startSec={starts[i]}
              selectedId={selectedId}
              playingId={playingId}
              onPlay={(itemId) => setPlayingId((p) => (p === itemId ? null : itemId))}
              onTap={onTap}
              onAddSong={() => setDrawer({ mode: 'add', sessionId: session.id })}
              onEditItem={(itemId) => setDrawer({ mode: 'edit', itemId })}
              notify={notify}
            />
          ))}
          <button className="add-session" onClick={() => dispatch({
            type: 'addSession', showId: show.id,
            session: { id: newId('sess'), name: `Session ${show.sessions.length + 1}`, targetMinutes: 45, items: [] },
          })}>
            + Add session
          </button>
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
          {activeSong && (
            <div className="drag-ghost">
              <i>⠿</i>
              <div><b>{activeSong.title}</b><span>{activeSong.artist}</span></div>
              <span className="mono">{activeSong.bpm ?? '—'} bpm</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="dock-wrap">
        {selectedId ? (
          <div className="toast toast--accent" ref={toastRef} role="status">
            <span>Swap “{selectedTitle}” — tap another song</span>
            <button onClick={() => setSelectedId(null)}>Cancel</button>
          </div>
        ) : toast ? (
          <div className="toast" ref={toastRef} role="status" key={toast.n}>
            <span>{toast.msg}</span>
            {canUndo && <button onClick={undo}>Undo</button>}
          </div>
        ) : null}
        <nav className="dock" aria-label="Setlist actions">
          <span className="dock__time">{formatDuration(totalSec)} / {formatDuration(slotSec)}</span>
          <span className="dock__sep" />
          <button className="dock__btn" disabled={!allItems.length} onClick={onStage}>Rehearse</button>
          <button className="dock__btn" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
          <button className="dock__btn" disabled={!show.sessions.length}
            onClick={() => show.sessions[0] && setDrawer({ mode: 'add', sessionId: show.sessions[0].id })}>+ Add song</button>
          <button className="dock__btn dock__btn--accent" onClick={onExport}>Export PDF</button>
        </nav>
      </div>

      {drawerTarget && (
        <SongDrawer key={JSON.stringify(drawer)} target={drawerTarget} members={members} onClose={() => setDrawer(null)} notify={notify} />
      )}
    </>
  )
}
