import { useEffect, useState } from 'react'
import { BandPanel } from './components/BandPanel'
import { ExportPanel } from './components/ExportPanel'
import { SetlistEditor } from './components/SetlistEditor'
import { newId, useStore } from './state/store'

export default function App() {
  const { state, dispatch, canUndo } = useStore()
  const [bandOpen, setBandOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const show = state.shows.find((s) => s.id === state.activeShowId) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.matches('input, textarea, select')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !typing) {
        e.preventDefault()
        dispatch({ type: 'undo' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  function addShow() {
    dispatch({
      type: 'addShow',
      show: {
        id: newId('show'), name: 'New show', date: new Date().toISOString().slice(0, 10), venue: '', slotMinutes: 120,
        sessions: [{ id: newId('sess'), name: 'Session 1', targetMinutes: 45, items: [] }],
      },
    })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 32 32" aria-hidden className="brand__mark">
            <path d="M4 20h18c0-3 2-5 6-5v-3H10c-3 0-5 2-6 5z" fill="currentColor" />
            <path d="M12 20v6h8v-6" fill="currentColor" opacity=".6" />
            <circle cx="21" cy="7" r="2.4" fill="var(--accent)" />
            <path d="M23.4 7V1.5l3.6 1" stroke="var(--accent)" strokeWidth="1.6" fill="none" />
          </svg>
          <span className="brand__name">Setsmith</span>
          <span className="brand__band">{state.bandName}</span>
        </div>
        <div className="topbar__actions">
          <select id="show-picker" aria-label="Choose show" value={show?.id ?? ''}
            onChange={(e) => dispatch({ type: 'selectShow', showId: e.target.value })}>
            {state.shows.map((s) => <option key={s.id} value={s.id}>{s.date} · {s.name}</option>)}
          </select>
          <button className="btn" onClick={addShow}>New show</button>
          <button className="btn" onClick={() => setBandOpen(true)}>Band</button>
          <button className="btn" disabled={!canUndo} onClick={() => dispatch({ type: 'undo' })} title="Undo (Ctrl+Z)">Undo</button>
          <button className="btn btn--primary" disabled={!show} onClick={() => setExportOpen(true)}>Export PDF</button>
        </div>
      </header>

      <main className="main">
        {show ? <SetlistEditor key={show.id} show={show} /> : (
          <div className="empty">
            <h1>No shows yet</h1>
            <p>Create a show, split it into sessions and start adding songs.</p>
            <button className="btn btn--primary" onClick={addShow}>New show</button>
          </div>
        )}
      </main>

      {bandOpen && <BandPanel onClose={() => setBandOpen(false)} />}
      {exportOpen && show && <ExportPanel show={show} onClose={() => setExportOpen(false)} />}
    </div>
  )
}
