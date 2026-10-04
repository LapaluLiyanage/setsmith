import { arrangeByBpm, moveItem, swapItems, type ArrangeMode } from '../lib/setlist'
import type { BandState, Member, Session, SetlistItem, Show, Song } from '../lib/types'

export type Action =
  | { type: 'selectShow'; showId: string }
  | { type: 'addShow'; show: Show }
  | { type: 'updateShow'; showId: string; patch: Partial<Omit<Show, 'id' | 'sessions'>> }
  | { type: 'deleteShow'; showId: string }
  | { type: 'addSession'; showId: string; session: Session }
  | { type: 'updateSession'; sessionId: string; patch: Partial<Pick<Session, 'name' | 'targetMinutes'>> }
  | { type: 'deleteSession'; sessionId: string }
  | { type: 'setSessions'; showId: string; sessions: Session[] }
  | { type: 'moveItem'; itemId: string; toSessionId: string; toIndex: number }
  | { type: 'swapItems'; aId: string; bId: string }
  | { type: 'arrange'; sessionId: string; mode: ArrangeMode }
  | { type: 'addSongToSession'; sessionId: string; song: Song; item: SetlistItem }
  | { type: 'updateItem'; itemId: string; patch: Partial<Omit<SetlistItem, 'id'>> }
  | { type: 'removeItem'; itemId: string }
  | { type: 'updateSong'; songId: string; patch: Partial<Omit<Song, 'id'>> }
  | { type: 'addMember'; member: Member }
  | { type: 'updateMember'; memberId: string; patch: Partial<Omit<Member, 'id'>> }
  | { type: 'removeMember'; memberId: string }
  | { type: 'undo' }
  | { type: 'replace'; state: BandState }

/** Actions that only change what's on screen, not the band's data, so they skip undo history. */
const NOT_UNDOABLE = new Set<Action['type']>(['selectShow', 'undo'])
const HISTORY_LIMIT = 50

export interface HistoryState {
  present: BandState
  past: BandState[]
}

function mapShows(state: BandState, fn: (show: Show) => Show): BandState {
  return { ...state, shows: state.shows.map(fn) }
}

function mapSessions(state: BandState, fn: (sessions: Session[]) => Session[]): BandState {
  return mapShows(state, (show) => {
    const sessions = fn(show.sessions)
    return sessions === show.sessions ? show : { ...show, sessions }
  })
}

function mapItems(state: BandState, fn: (items: SetlistItem[]) => SetlistItem[]): BandState {
  return mapSessions(state, (sessions) => sessions.map((s) => ({ ...s, items: fn(s.items) })))
}

export function bandReducer(state: BandState, action: Action): BandState {
  switch (action.type) {
    case 'replace':
      return action.state
    case 'selectShow':
      return { ...state, activeShowId: action.showId }
    case 'addShow':
      return { ...state, shows: [...state.shows, action.show], activeShowId: action.show.id }
    case 'updateShow':
      return mapShows(state, (s) => (s.id === action.showId ? { ...s, ...action.patch } : s))
    case 'deleteShow': {
      const shows = state.shows.filter((s) => s.id !== action.showId)
      const activeShowId = state.activeShowId === action.showId ? (shows[0]?.id ?? null) : state.activeShowId
      return { ...state, shows, activeShowId }
    }
    case 'addSession':
      return mapShows(state, (s) => (s.id === action.showId ? { ...s, sessions: [...s.sessions, action.session] } : s))
    case 'updateSession':
      return mapSessions(state, (sessions) =>
        sessions.map((s) => (s.id === action.sessionId ? { ...s, ...action.patch } : s)))
    case 'deleteSession':
      return mapSessions(state, (sessions) => sessions.filter((s) => s.id !== action.sessionId))
    case 'setSessions':
      return mapShows(state, (s) => (s.id === action.showId ? { ...s, sessions: action.sessions } : s))
    case 'moveItem':
      return mapSessions(state, (sessions) =>
        sessions.some((s) => s.id === action.toSessionId)
          ? moveItem(sessions, action.itemId, action.toSessionId, action.toIndex)
          : sessions)
    case 'swapItems':
      return mapSessions(state, (sessions) => swapItems(sessions, action.aId, action.bId))
    case 'arrange':
      return mapSessions(state, (sessions) =>
        sessions.map((s) =>
          s.id === action.sessionId ? { ...s, items: arrangeByBpm(s.items, state.songs, action.mode) } : s))
    case 'addSongToSession': {
      const withSong = { ...state, songs: { ...state.songs, [action.song.id]: action.song } }
      return mapSessions(withSong, (sessions) =>
        sessions.map((s) => (s.id === action.sessionId ? { ...s, items: [...s.items, action.item] } : s)))
    }
    case 'updateItem':
      return mapItems(state, (items) => items.map((i) => (i.id === action.itemId ? { ...i, ...action.patch } : i)))
    case 'removeItem':
      return mapItems(state, (items) => items.filter((i) => i.id !== action.itemId))
    case 'updateSong': {
      const current = state.songs[action.songId]
      if (!current) return state
      return { ...state, songs: { ...state.songs, [action.songId]: { ...current, ...action.patch } } }
    }
    case 'addMember':
      return { ...state, members: [...state.members, action.member] }
    case 'updateMember':
      return { ...state, members: state.members.map((m) => (m.id === action.memberId ? { ...m, ...action.patch } : m)) }
    case 'removeMember': {
      const members = state.members.filter((m) => m.id !== action.memberId)
      // Songs the member used to sing become unassigned rather than pointing at nobody.
      const cleared = mapItems({ ...state, members }, (items) =>
        items.map((i) => ({
          ...i,
          singerId: i.singerId === action.memberId ? null : i.singerId,
          singerId2: i.singerId2 === action.memberId ? null : i.singerId2,
          ...(i.coSingerIds ? { coSingerIds: i.coSingerIds.filter((id) => id !== action.memberId) } : {}),
        })))
      return cleared
    }
    case 'undo':
      return state
  }
}

export function historyReducer(history: HistoryState, action: Action): HistoryState {
  if (action.type === 'undo') {
    const previous = history.past[history.past.length - 1]
    if (!previous) return history
    // Keep the user on the show they're looking at even if the undone step changed it.
    const present = previous.shows.some((s) => s.id === history.present.activeShowId)
      ? { ...previous, activeShowId: history.present.activeShowId }
      : previous
    return { present, past: history.past.slice(0, -1) }
  }
  if (action.type === 'replace') return { present: action.state, past: [] }
  const next = bandReducer(history.present, action)
  if (next === history.present) return history
  if (NOT_UNDOABLE.has(action.type)) return { ...history, present: next }
  return { present: next, past: [...history.past, history.present].slice(-HISTORY_LIMIT) }
}

/** What gets synced: everything except which show this device has open. */
export const signature = (s: BandState) => JSON.stringify({ ...s, activeShowId: null })
