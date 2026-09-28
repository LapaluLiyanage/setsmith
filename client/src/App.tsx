import { useEffect, useState } from 'react'
import { AuthScreen, LoadingScreen, OnboardScreen, UnconfiguredScreen } from './components/AuthGate'
import { BandPanel } from './components/BandPanel'
import { ExportPanel } from './components/ExportPanel'
import { LibraryView } from './components/LibraryView'
import { SetlistEditor } from './components/SetlistEditor'
import { StageView } from './components/StageView'
import { newId, useStore } from './state/store'
import { useTheme } from './state/theme'

/** Anvil with a music note resting on it: the Setsmith mark from the design. */
function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden fill="currentColor">
      <rect x="13" y="1" width="2" height="11" />
      <ellipse cx="11.5" cy="11" rx="3.5" ry="3" />
      <path d="M0 15h26l-4.2 6H4.2z" />
      <rect x="8" y="21" width="10" height="5" />
    </svg>
  )
}

export default function App() {
  const { state, dispatch, cloud } = useStore()
  const [theme, toggleTheme] = useTheme()
  const [bandOpen, setBandOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)
  const [view, setView] = useState<'setlist' | 'library'>('setlist')
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

  useEffect(() => {
    if (!cloud.notice) return
    const t = setTimeout(cloud.dismissNotice, 5000)
    return () => clearTimeout(t)
  }, [cloud.notice, cloud.dismissNotice])

  if (cloud.gate === 'unconfigured') return <UnconfiguredScreen />
  if (cloud.gate === 'auth') return <AuthScreen />
  if (cloud.gate === 'onboard') return <OnboardScreen />
  if (cloud.gate === 'loading') return <LoadingScreen />

  return (
    <div className="app">
      <div className="frame">
        <header className="topbar">
          <div className="brand">
            <Mark />
            <span className="brand__name">Setsmith</span>
            <span className="brand__band">{state.bandName.toUpperCase()}</span>
            {cloud.band && <span className={'sync-dot sync-dot--' + cloud.status} title={cloud.status} aria-label={'Sync: ' + cloud.status} />}
          </div>
          <div className="topbar__spacer" />
          <nav className="nav" aria-label="Main">
            <button className={'nav__item nav__item--keep' + (view === 'setlist' ? ' nav__item--active' : '')}
              aria-current={view === 'setlist' ? 'page' : undefined} onClick={() => setView('setlist')}>Setlist</button>
            <button className="nav__item nav__item--keep" disabled={!show} onClick={() => setStageOpen(true)}>Stage view</button>
            <button className={'nav__item nav__item--keep' + (view === 'library' ? ' nav__item--active' : '')}
              aria-current={view === 'library' ? 'page' : undefined} onClick={() => setView('library')}>Library</button>
            <button className="nav__item nav__item--keep" onClick={() => setBandOpen(true)}>Band</button>
            <button className="nav__item nav__item--keep" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </nav>
          <select id="show-picker" className="show-select" aria-label="Choose show" value={show?.id ?? ''}
            onChange={(e) => dispatch({ type: 'selectShow', showId: e.target.value })}>
            {state.shows.map((s) => <option key={s.id} value={s.id}>{s.date} · {s.name}</option>)}
          </select>
          <button className="pill pill--dark" onClick={addShow}>+ New show</button>
        </header>

        {cloud.readOnly && <p className="viewer-banner" role="status">You have view-only access to this band. Ask the manager for editor access to make changes.</p>}

        {view === 'library' ? (
          <LibraryView show={show} />
        ) : show ? (
          <SetlistEditor key={show.id} show={show} theme={theme} onShare={() => setBandOpen(true)} onExport={() => setExportOpen(true)} onStage={() => setStageOpen(true)} />
        ) : (
          <div className="empty">
            <h1>No shows yet</h1>
            <p className="muted">Create a show, split it into sessions and start adding songs.</p>
            <button className="pill pill--accent pill--lg" onClick={addShow}>New show</button>
          </div>
        )}
      </div>

      <a className="credit" href="https://lapalu.me" target="_blank" rel="noreferrer">Built by Lapalu Liyanage</a>

      {cloud.notice && <div className="toast" role="status" onClick={cloud.dismissNotice}>{cloud.notice}</div>}
      {bandOpen && <BandPanel show={show} onClose={() => setBandOpen(false)} />}
      {exportOpen && show && <ExportPanel show={show} onClose={() => setExportOpen(false)} />}
      {stageOpen && show && <StageView show={show} onClose={() => setStageOpen(false)} />}
    </div>
  )
}
