import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { camelot, formatKey, transposeKey } from '../lib/music'
import { formatDuration } from '../lib/setlist'
import { singerBadge } from '../lib/singers'
import type { Member, SetlistItem, Song } from '../lib/types'
import { thumbUrl, watchUrl } from '../lib/youtube'

interface Props {
  item: SetlistItem
  song: Song
  position: number
  members: Member[]
  selected: boolean
  onTap: () => void
  onEdit: () => void
  onSinger: (singerId: string | null) => void
}

const shortKey = (text: string) => text.replace(' major', '').replace(' minor', 'm')

export function SongRow({ item, song, position, members, selected, onTap, onEdit, onSinger }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const badge = singerBadge(members, item.singerId)
  const singers = members.filter((m) => m.isSinger)
  const played = song.key ? transposeKey(song.key, item.transpose) : null
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

  function onKeyDown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() }
  }

  return (
    <li
      ref={setNodeRef}
      data-sid={item.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`song${isDragging ? ' song--dragging' : ''}${selected ? ' song--selected' : ''}`}
      onClick={onTap}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-label={`${position}. ${song.title}. ${selected ? 'Selected for swap.' : 'Press to pick for quick swap.'}`}
    >
      <button ref={setActivatorNodeRef} className="song__grip" aria-label={`Drag ${song.title}`} onClick={stop} {...attributes} {...listeners}>
        <span>⠿</span><span>{String(position).padStart(2, '0')}</span>
      </button>

      <div className="song__thumb">
        {song.youtubeId ? <img src={thumbUrl(song.youtubeId)} alt="" loading="lazy" /> : <span>YT</span>}
      </div>

      <div className="song__body">
        <div>
          <span className="song__title">{song.title}</span>
          <span className="song__artist">{song.artist || 'Unknown artist'}</span>
        </div>
        <div className="song__tags">
          <div className="menu-wrap" ref={menuRef}>
            <button className="singer-btn" aria-haspopup="menu" aria-expanded={menuOpen}
              onClick={(e) => { stop(e); setMenuOpen((o) => !o) }}>
              <span className="avatar" style={{ background: badge.color }}>{badge.initial}</span>{badge.name}
            </button>
            {menuOpen && (
              <div className="menu menu--left" role="menu" onClick={stop}>
                {[...singers, null].map((m) => {
                  const b = singerBadge(members, m?.id ?? null)
                  return (
                    <button key={m?.id ?? 'none'} role="menuitem" className="menu__row"
                      onClick={() => { setMenuOpen(false); onSinger(m?.id ?? null) }}>
                      <span className="avatar avatar--lg" style={{ background: b.color }}>{b.initial}</span>
                      <span>{b.name}</span>
                      <span className="mono">{(m?.id ?? null) === item.singerId ? '●' : ''}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <span className={`tag tag--dark${song.bpm ? '' : ' tag--missing'}`} title={song.bpmSource ? `BPM from ${song.bpmSource}` : 'No BPM yet'}>
            {song.bpm ?? '—'} bpm
          </span>
          <span className={`tag${played ? '' : ' tag--missing'}`} title={song.key ? `Original key: ${formatKey(song.key)}` : 'No key yet'}>
            {played ? `${shortKey(formatKey(played))} · ${camelot(played)}` : 'key ?'}
          </span>
          {item.transpose !== 0 && song.key && (
            <span className="tag tag--accent">{item.transpose > 0 ? '+' : '−'}{Math.abs(item.transpose)} → {shortKey(formatKey(played!))}</span>
          )}
        </div>
      </div>

      <div className="song__side">
        <span className="song__dur">{formatDuration(song.durationSec)}</span>
        <div className="song__actions">
          {song.youtubeId ? (
            <a className="icon-btn icon-btn--dark" href={watchUrl(song.youtubeId)} target="_blank" rel="noreferrer"
              title="Open on YouTube" aria-label={`Play ${song.title} on YouTube`} onClick={stop}>▶</a>
          ) : (
            <a className="icon-btn" title="Search YouTube" aria-label={`Search ${song.title} on YouTube`} target="_blank" rel="noreferrer"
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`} onClick={stop}>▶</a>
          )}
          <button className="icon-btn" title="Edit song" aria-label={`Edit ${song.title}`} onClick={(e) => { stop(e); onEdit() }}>⋯</button>
        </div>
      </div>
    </li>
  )
}
