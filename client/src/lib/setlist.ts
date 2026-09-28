import { keysCompatible, transposeKey } from './music'
import type { Session, SetlistItem, Song } from './types'

export interface ItemLocation {
  sessionIndex: number
  itemIndex: number
}

export function findItem(sessions: Session[], itemId: string): ItemLocation | null {
  for (let s = 0; s < sessions.length; s++) {
    const i = sessions[s].items.findIndex((item) => item.id === itemId)
    if (i !== -1) return { sessionIndex: s, itemIndex: i }
  }
  return null
}

/**
 * Move an item to a position in a (possibly different) session.
 * `toIndex` is the index the item should end up at in the target session.
 */
export function moveItem(
  sessions: Session[],
  itemId: string,
  toSessionId: string,
  toIndex: number,
): Session[] {
  const from = findItem(sessions, itemId)
  const toSessionIndex = sessions.findIndex((s) => s.id === toSessionId)
  if (!from || toSessionIndex === -1) return sessions

  const next = sessions.map((s) => ({ ...s, items: [...s.items] }))
  const [item] = next[from.sessionIndex].items.splice(from.itemIndex, 1)
  const target = next[toSessionIndex].items
  target.splice(Math.max(0, Math.min(toIndex, target.length)), 0, item)
  return next
}

/** Swap two items' positions, within one session or across two. */
export function swapItems(sessions: Session[], aId: string, bId: string): Session[] {
  const a = findItem(sessions, aId)
  const b = findItem(sessions, bId)
  if (!a || !b || aId === bId) return sessions

  const next = sessions.map((s) => ({ ...s, items: [...s.items] }))
  const itemA = next[a.sessionIndex].items[a.itemIndex]
  next[a.sessionIndex].items[a.itemIndex] = next[b.sessionIndex].items[b.itemIndex]
  next[b.sessionIndex].items[b.itemIndex] = itemA
  return next
}

export function sessionDurationSec(session: Session, songs: Record<string, Song>): number {
  return session.items.reduce((sum, item) => sum + (songs[item.songId]?.durationSec ?? 0), 0)
}

export type ArrangeMode = 'build' | 'cooldown' | 'mountain'

export const ARRANGE_LABELS: Record<ArrangeMode, string> = {
  build: 'Build up (slow → fast)',
  cooldown: 'Cool down (fast → slow)',
  mountain: 'Peak in the middle',
}

/**
 * Reorder items by BPM. Songs without a BPM keep their relative order and go last,
 * so an unknown tempo never gets silently dropped into the middle of a build.
 */
export function arrangeByBpm(
  items: SetlistItem[],
  songs: Record<string, Song>,
  mode: ArrangeMode,
): SetlistItem[] {
  const known = items.filter((i) => songs[i.songId]?.bpm != null)
  const unknown = items.filter((i) => songs[i.songId]?.bpm == null)
  const ascending = [...known].sort((x, y) => songs[x.songId].bpm! - songs[y.songId].bpm!)

  let arranged: SetlistItem[]
  if (mode === 'build') arranged = ascending
  else if (mode === 'cooldown') arranged = [...ascending].reverse()
  else {
    // Deal the slowest songs alternately to the two ends so tempo rises to a peak and falls again.
    const left: SetlistItem[] = []
    const right: SetlistItem[] = []
    ascending.forEach((item, i) => (i % 2 === 0 ? left : right).push(item))
    arranged = [...left, ...right.reverse()]
  }
  return [...arranged, ...unknown]
}

export type TransitionWarning = { kind: 'key-clash'; from: string; to: string }

/**
 * Warnings for the join between item i and i+1 (keyed by the second item's id).
 * Uses the performed key, i.e. after transpose.
 */
export function keyClashes(items: SetlistItem[], songs: Record<string, Song>): Set<string> {
  const clashes = new Set<string>()
  for (let i = 1; i < items.length; i++) {
    const a = songs[items[i - 1].songId]?.key
    const b = songs[items[i].songId]?.key
    if (!a || !b) continue
    const performedA = transposeKey(a, items[i - 1].transpose)
    const performedB = transposeKey(b, items[i].transpose)
    if (!keysCompatible(performedA, performedB)) clashes.add(items[i].id)
  }
  return clashes
}

/** Ids of items that extend a run of more than `maxRun` songs by the same singer. */
export function singerOverload(items: SetlistItem[], maxRun = 3): Set<string> {
  const flagged = new Set<string>()
  let run = 0
  items.forEach((item, i) => {
    run = item.singerId && item.singerId === items[i - 1]?.singerId ? run + 1 : 1
    if (item.singerId && run > maxRun) flagged.add(item.id)
  })
  return flagged
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = Math.round(totalSec % 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}:${String(s).padStart(2, '0')}`
}
