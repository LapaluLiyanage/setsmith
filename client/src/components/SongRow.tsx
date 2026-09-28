import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { camelot, formatKey, transposeKey } from '../lib/music'
import { formatDuration } from '../lib/setlist'
import type { Member, SetlistItem, Song } from '../lib/types'
import { thumbUrl, watchUrl } from '../lib/youtube'
import { useStore } from '../state/store'

interface Props {
  item: SetlistItem
  song: Song
  position: number
  singers: Member[]
  swapSelected: boolean
  onSwapClick: () => void
  onEdit: () => void
  keyClash: boolean
  singerOverload: boolean
}

export function SongRow({ item, song, position, singers, swapSelected, onSwapClick, onEdit, keyClash, singerOverload }: Props) {
  const { dispatch } = useStore()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const performedKey = song.key ? transposeKey(song.key, item.transpose) : null

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`row${isDragging ? ' row--dragging' : ''}${swapSelected ? ' row--swap' : ''}`}
    >
      {(keyClash || singerOverload) && (
        <div className="row__warn" role="note">
          {keyClash && <span>Key jump from the previous song</span>}
          {singerOverload && <span>Same singer 4+ songs in a row</span>}
        </div>
      )}
      <div className="row__main">
        <button
          ref={setActivatorNodeRef}
          className="row__handle"
          aria-label={`Drag ${song.title}`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="row__num">{position}</span>
        {song.youtubeId ? (
          <a className="row__thumb" href={watchUrl(song.youtubeId)} target="_blank" rel="noreferrer" title="Open on YouTube">
            <img src={thumbUrl(song.youtubeId)} alt="" loading="lazy" />
            <span className="row__play" aria-hidden>▶</span>
          </a>
        ) : (
          <span className="row__thumb row__thumb--empty" title="No YouTube link yet">♪</span>
        )}
        <button className="row__title" onClick={onEdit} title="Edit song">
          <strong>{song.title}</strong>
          <span>{song.artist || 'Unknown artist'}</span>
        </button>
        <select
          className="row__singer"
          aria-label="Singer"
          value={item.singerId ?? ''}
          onChange={(e) => dispatch({ type: 'updateItem', itemId: item.id, patch: { singerId: e.target.value || null } })}
        >
          <option value="">No singer</option>
          {singers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <span className={`badge badge--bpm${song.bpm ? '' : ' badge--missing'}`} title={song.bpmSource ? `BPM source: ${song.bpmSource}` : 'BPM not set'}>
          {song.bpm ?? '—'} <small>BPM</small>
        </span>
        <span className={`badge badge--key${performedKey ? '' : ' badge--missing'}`} title={song.key ? `Original: ${formatKey(song.key)}` : 'Key not set'}>
          {performedKey ? (
            <>
              {formatKey(performedKey).replace(' major', '').replace(' minor', 'm')}
              <small>{camelot(performedKey)}</small>
            </>
          ) : '—'}
        </span>
        {item.transpose !== 0 && <span className="badge badge--transpose">{item.transpose > 0 ? '+' : ''}{item.transpose}</span>}
        <span className="row__dur">{formatDuration(song.durationSec)}</span>
        <button
          className={`row__swap${swapSelected ? ' is-active' : ''}`}
          onClick={onSwapClick}
          aria-pressed={swapSelected}
          title={swapSelected ? 'Cancel swap' : 'Quick swap: pick this song, then another'}
        >
          ⇄
        </button>
      </div>
    </li>
  )
}
