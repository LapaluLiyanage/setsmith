export type Mode = 'major' | 'minor'

/** A musical key: tonic as a pitch class (0 = C … 11 = B) plus mode. */
export interface MusicalKey {
  tonic: number
  mode: Mode
}

export type BpmSource = 'lookup' | 'analysis' | 'tap' | 'manual'

export type Lang = 'SI' | 'EN'

export type Role = 'manager' | 'editor' | 'viewer'

export interface Member {
  id: string
  name: string
  role: Role
  isSinger: boolean
  keyRange?: { from: number; to: number }
}

/** A song in the band's library. Reused across shows so BPM/key are looked up once. */
export interface Song {
  id: string
  title: string
  artist: string
  youtubeId: string | null
  durationSec: number
  bpm: number | null
  key: MusicalKey | null
  bpmSource: BpmSource | null
  /** Set by hand in the library; otherwise guessed from the script of the title. */
  lang?: Lang
}

/** One slot in a session's running order. */
export interface SetlistItem {
  id: string
  songId: string
  singerId: string | null
  /** Semitones to shift from the original key (e.g. -2). */
  transpose: number
  notes: string
}

export interface Session {
  id: string
  name: string
  targetMinutes: number
  items: SetlistItem[]
}

export interface Show {
  id: string
  name: string
  date: string
  venue: string
  slotMinutes: number
  sessions: Session[]
}

export interface BandState {
  bandName: string
  members: Member[]
  songs: Record<string, Song>
  shows: Show[]
  activeShowId: string | null
}
