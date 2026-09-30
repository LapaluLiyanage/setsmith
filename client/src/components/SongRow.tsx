import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { camelot, formatKey, transposeKey } from '../lib/music'
import { formatDuration } from '../lib/setlist'
import { singerBadge } from '../lib/singers'
import type { Member, SetlistItem, Song } from '../lib/types'
import { thumbUrl } from '../lib/youtube'

interface Props {
  item: SetlistItem
  song: Song
  position: number
  members: Member[]
  selected: boolean
  playing: 0 | 1 | 2
  readOnly: boolean
  onPlay: (part: 1 | 2) => void
  onTap: () => void
  onEdit: () => void
  onSinger: (singerId: string | null) => void
}

const shortKey = (text: string) => text.replace(' major', '').replace(' minor', 'm')

export function SongRow({ item, song, position, members, selected, playing, readOnly, onPlay, onTap, onEdit, onSinger }: Props) {
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
  const badge2 = song.youtubeId2 && item.singerId2 ? singerBadge(members, item.singerId2) : null
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
      onClick={readOnly ? undefined : onTap}
      onKeyDown={readOnly ? undefined : onKeyDown}
      tabIndex={readOnly ? undefined : 0}
      aria-label={readOnly ? `${position}. ${song.title}` : `${position}. ${song.title}. ${selected ? 'Selected for swap.' : 'Press to pick for quick swap.'}`}
    >
      {readOnly ? (
        <span className="song__grip song__grip--static"><span>{String(position).padStart(2, '0')}</span></span>
      ) : (
        <button ref={setActivatorNodeRef} className="song__grip" aria-label={`Drag ${song.title}`} onClick={stop} {...attributes} {...listeners}>
          <span>⠿</span><span>{String(position).padStart(2, '0')}</span>
        </button>
      )}

      <div className="song__thumb">
        {song.youtubeId ? <img src={thumbUrl(song.youtubeId)} alt="" loading="lazy" /> : <span>YT</span>}
      </div>

      <div className="song__body">
        <div>
          <span className="song__title">{song.title}</span>
          <span className="song__artist">{song.artist || 'Unknown artist'}</span>
        </div>
        <div className="song__tags">
          {readOnly ? (
            <span className="singer-btn singer-btn--static">
              <span className="avatar" style={{ background: badge.color }}>{badge.initial}</span>{badge.name}
            </span>
          ) : (
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
          )}
          {badge2 && (
            <span className="singer-btn singer-btn--static" title="Singer for song 2">
              <span className="avatar" style={{ background: badge2.color }}>{badge2.initial}</span>{badge2.name}
            </span>
          )}
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
          {song.youtubeId2 ? (
            <>
              <button type="button" className={`icon-btn${playing === 1 ? ' icon-btn--dark' : ''}`} aria-pressed={playing === 1}
                title={playing === 1 ? 'Stop' : 'Play song 1'} aria-label={`${playing === 1 ? 'Stop' : 'Play'} song 1 of ${song.title}`}
                onClick={(e) => { stop(e); onPlay(1) }}>{playing === 1 ? '■' : '▶1'}</button>
              <button type="button" className={`icon-btn${playing === 2 ? ' icon-btn--dark' : ''}`} aria-pressed={playing === 2}
                title={playing === 2 ? 'Stop' : 'Play song 2'} aria-label={`${playing === 2 ? 'Stop' : 'Play'} song 2 of ${song.title}`}
                onClick={(e) => { stop(e); onPlay(2) }}>{playing === 2 ? '■' : '▶2'}</button>
            </>
          ) : song.youtubeId ? (
            <button type="button" className={`icon-btn${playing ? ' icon-btn--dark' : ''}`} aria-pressed={!!playing}
              title={playing ? 'Stop' : 'Play here'} aria-label={`${playing ? 'Stop' : 'Play'} ${song.title}`}
              onClick={(e) => { stop(e); onPlay(1) }}>{playing ? '■' : '▶'}</button>
          ) : (
            <a className="icon-btn" title="Search YouTube" aria-label={`Search ${song.title} on YouTube`} target="_blank" rel="noreferrer"
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`} onClick={stop}>▶</a>
          )}
          {!readOnly && (
            <button className="icon-btn" title="Edit song" aria-label={`Edit ${song.title}`} onClick={(e) => { stop(e); onEdit() }}>⋯</button>
          )}
        </div>
      </div>
    </li>
  )
}
