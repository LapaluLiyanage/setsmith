import { useEffect, useMemo, useState } from 'react'
import {
  BPM_CEIL, BPM_FLOOR, buildLibrary, filterLibrary, filtersActive, NO_FILTERS, type LibraryFilters, type LibraryRow,
} from '../lib/library'
import { formatKey } from '../lib/music'
import { singerBadge } from '../lib/singers'
import type { Lang, Show } from '../lib/types'
import { newId, useStore } from '../state/store'

const BPM_PRESETS = [
  { label: 'Slow', min: BPM_FLOOR, max: 89 },
  { label: 'Mid', min: 90, max: 110 },
  { label: 'Fast', min: 111, max: BPM_CEIL },
]

const shortKey = (text: string) => text.replace(' major', '').replace(' minor', 'm')

export function LibraryView({ show }: { show: Show | null }) {
  const { state, dispatch } = useStore()
  const [filters, setFilters] = useState<LibraryFilters>(NO_FILTERS)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const set = (patch: Partial<LibraryFilters>) => setFilters((f) => ({ ...f, ...patch }))

  const all = useMemo(() => buildLibrary(state), [state])
  const rows = useMemo(() => filterLibrary(all, filters), [all, filters])
  const singers = state.members.filter((m) => m.isSinger)

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(t)
  }, [flash])

  useEffect(() => {
    if (!menuFor) return
    const close = () => setMenuFor(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey) }
  }, [menuFor])

  function addTo(row: LibraryRow, sessionId: string, sessionName: string) {
    dispatch({
      type: 'addSongToSession', sessionId, song: row.song,
      item: { id: newId('item'), songId: row.song.id, singerId: row.singerId, transpose: 0, notes: '' },
    })
    setMenuFor(null)
    setFlash('Added “' + row.song.title + '” to ' + sessionName)
  }

  const toggleLang = (row: LibraryRow) =>
    dispatch({ type: 'updateSong', songId: row.song.id, patch: { lang: (row.lang === 'SI' ? 'EN' : 'SI') as Lang } })

  const clear = () => setFilters(NO_FILTERS)

  const singerOptions = [
    ...singers.map((m) => ({ id: m.id, badge: singerBadge(state.members, m.id), n: all.filter((r) => r.singerId === m.id).length })),
    { id: 'none', badge: singerBadge(state.members, null), n: all.filter((r) => !r.singerId).length },
  ]

  return (
    <div className="library">
      <button className="pill library__filter-toggle" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
        {filtersOpen ? 'Hide filters' : 'Filters'}{filtersActive(filters) ? ' •' : ''}
      </button>
      <aside className={'library__side' + (filtersOpen ? ' is-open' : '')} aria-label="Filters">
        <div className="lf">
          <span className="lf__label">SINGER</span>
          {singerOptions.map((s) => (
            <button key={s.id} className={'lf__opt' + (filters.singerId === s.id ? ' is-on' : '')} aria-pressed={filters.singerId === s.id}
              onClick={() => set({ singerId: filters.singerId === s.id ? null : s.id })}>
              <span className="avatar" style={{ background: s.badge.color }}>{s.badge.initial}</span>
              <span>{s.id === 'none' ? 'Unassigned' : s.badge.name}</span>
              <small>{s.n}</small>
            </button>
          ))}
        </div>

        <div className="lf">
          <span className="lf__label">BPM RANGE</span>
          <div className="lf__range"><b>{filters.bpmMin}</b><b>{filters.bpmMax}</b></div>
          <input type="range" aria-label="Minimum BPM" min={BPM_FLOOR} max={BPM_CEIL} value={filters.bpmMin}
            onChange={(e) => set({ bpmMin: Math.min(Number(e.target.value), filters.bpmMax) })} />
          <input type="range" aria-label="Maximum BPM" min={BPM_FLOOR} max={BPM_CEIL} value={filters.bpmMax}
            onChange={(e) => set({ bpmMax: Math.max(Number(e.target.value), filters.bpmMin) })} />
          <div className="lf__presets">
            {BPM_PRESETS.map((p) => (
              <button key={p.label} className="lf__preset" onClick={() => set({ bpmMin: p.min, bpmMax: p.max })}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="lf">
          <span className="lf__label">KEY (CAMELOT)</span>
          <div className="lf__keys">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <button key={n} className={'lf__key' + (filters.keyNumber === n ? ' is-on' : '')} aria-pressed={filters.keyNumber === n}
                onClick={() => set({ keyNumber: filters.keyNumber === n ? null : n })}>{n}</button>
            ))}
          </div>
        </div>

        <button className="lf__clear" onClick={clear} disabled={!filtersActive(filters)}>Clear filters</button>
      </aside>

      <main className="library__main">
        <div className="library__head">
          <div>
            <div className="library__count">{rows.length === all.length ? all.length + ' SONGS' : rows.length + ' OF ' + all.length + ' SONGS'}</div>
            <h1>Song library</h1>
          </div>
          <label className="library__search">
            <span aria-hidden>⌕</span>
            <input value={filters.query} onChange={(e) => set({ query: e.target.value })} placeholder="Search title or artist" aria-label="Search songs" />
          </label>
        </div>

        <div className="library__langs" role="group" aria-label="Language">
          {([[null, 'All'], ['SI', 'Sinhala'], ['EN', 'International']] as const).map(([value, label]) => (
            <button key={label} className={'lf__preset' + (filters.lang === value ? ' is-on' : '')} aria-pressed={filters.lang === value}
              onClick={() => set({ lang: value })}>{label}</button>
          ))}
        </div>

        <div className="lib-table" role="table" aria-label="Songs">
          <div className="lib-row lib-row--head" role="row">
            <span>SONG</span><span>LANG</span><span>USUAL SINGER</span><span>BPM</span><span>KEY</span><span>PLAYED</span><span />
          </div>
          {rows.map((r) => {
            const badge = singerBadge(state.members, r.singerId)
            const played = r.played === 0 ? 'never' : r.played + (r.played > 1 ? ' shows' : ' show')
            return (
              <div className="lib-row" role="row" key={r.song.id}>
                <div className="lib-row__song">
                  <b>{r.song.title}</b><span>{r.song.artist || 'Unknown artist'}</span>
                </div>
                <button className="lib-row__lang" onClick={() => toggleLang(r)} title="Click to switch Sinhala / International">{r.lang}</button>
                <span className="lib-row__singer" data-label="Singer">
                  <span className="avatar" style={{ background: badge.color }}>{badge.initial}</span>{r.singerId ? badge.name : '—'}
                </span>
                <span className="lib-row__mono" data-label="BPM">{r.song.bpm ?? '—'}</span>
                <span className="lib-row__mono" data-label="Key">{r.song.key ? shortKey(formatKey(r.song.key)) + ' · ' + r.camelot : '—'}</span>
                <span className="lib-row__mono lib-row__muted" data-label="Played">{played}</span>
                <div className="lib-row__add">
                  <button className="pill" disabled={!show} title={show ? undefined : 'Create a show first'}
                    aria-haspopup="menu" aria-expanded={menuFor === r.song.id}
                    onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === r.song.id ? null : r.song.id) }}>+ Add to show</button>
                  {menuFor === r.song.id && show && (
                    <ul className="lib-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                      <li className="lib-menu__title">{show.name}</li>
                      {show.sessions.map((s) => (
                        <li key={s.id} role="none"><button role="menuitem" onClick={() => addTo(r, s.id, s.name)}>{s.name}</button></li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
          {rows.length === 0 && (
            <div className="lib-empty">
              <b>{all.length === 0 ? 'No songs yet' : 'Nothing matches'}</b>
              <span>{all.length === 0 ? 'Songs you add to a setlist show up here.' : 'Try a wider BPM range or clear the key filter.'}</span>
              {all.length > 0 && <button className="pill pill--accent" onClick={clear}>Clear filters</button>}
            </div>
          )}
        </div>
      </main>
      {flash && <div className="library__flash" role="status">{flash}</div>}
    </div>
  )
}
