import { transposeChordSheet } from './chordSheet'
import { camelot, formatKey, transposeKey } from './music'
import { formatDuration } from './setlist'
import { singerBadge, type SingerBadge } from './singers'
import type { Member, Show, Song } from './types'

export interface StageSong {
  itemId: string
  /** 1-based position across the whole night. */
  number: number
  sessionName: string
  /** 1-based position inside its session, and that session's size. */
  inSession: number
  sessionSize: number
  title: string
  /** Shorter title for the big Stage view display; falls back to the full title. */
  stageTitle: string
  artist: string
  singer: SingerBadge
  /** Key the band plays (after transpose), e.g. "G major". */
  key: string | null
  camelot: string | null
  /** e.g. "play in G (−2)" when transposed. */
  transposeNote: string | null
  bpm: number | null
  duration: string
  notes: string
  youtubeId: string | null
  /** Second video for a mashup; null for a regular song. */
  youtubeId2: string | null
  /** Song's chord sheet, transposed for this slot; null when the song has none. */
  chordSheet: string | null
}

const short = (text: string) => text.replace(' major', '').replace(' minor', 'm')

/** Flatten a show into the order it will be played, with everything the stage screen shows. */
export function buildStageList(show: Show, songs: Record<string, Song>, members: Member[]): StageSong[] {
  const list: StageSong[] = []
  for (const session of show.sessions) {
    const items = session.items.filter((i) => songs[i.songId])
    items.forEach((item, i) => {
      const song = songs[item.songId]
      const played = song.key ? transposeKey(song.key, item.transpose) : null
      list.push({
        itemId: item.id,
        number: list.length + 1,
        sessionName: session.name,
        inSession: i + 1,
        sessionSize: items.length,
        title: song.title,
        stageTitle: song.shortTitle?.trim() || song.title,
        artist: song.artist,
        singer: singerBadge(members, item.singerId),
        key: played ? formatKey(played) : null,
        camelot: played ? camelot(played) : null,
        transposeNote: played && item.transpose
          ? `play in ${short(formatKey(played))} (${item.transpose > 0 ? '+' : '−'}${Math.abs(item.transpose)})`
          : null,
        bpm: song.bpm,
        duration: song.durationSec ? formatDuration(song.durationSec) : '',
        notes: item.notes,
        youtubeId: song.youtubeId,
        youtubeId2: song.youtubeId2 ?? null,
        chordSheet: song.chordSheet ? transposeChordSheet(song.chordSheet, item.transpose) : null,
      })
    })
  }
  return list
}

/** Seconds per beat for the pulsing dot; a gentle 60 BPM when the tempo is unknown. */
export const beatSeconds = (bpm: number | null) => 60 / (bpm && bpm > 0 ? bpm : 60)
