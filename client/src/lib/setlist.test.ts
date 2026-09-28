import { describe, expect, it } from 'vitest'
import { parseKey } from './music'
import {
  arrangeByBpm, formatDuration, keyClashes, moveItem, sessionDurationSec, singerOverload, swapItems,
} from './setlist'
import type { Session, SetlistItem, Song } from './types'

const song = (id: string, bpm: number | null, key: string | null = null, durationSec = 200): Song => ({
  id, title: id, artist: '', youtubeId: null, durationSec, bpm,
  key: key ? parseKey(key) : null, bpmSource: bpm ? 'manual' : null,
})
const item = (id: string, singerId: string | null = null, transpose = 0): SetlistItem => ({
  id, songId: id, singerId, transpose, notes: '',
})
const ids = (s: Session[]) => s.map((x) => x.items.map((i) => i.id))

const sessions: Session[] = [
  { id: 's1', name: 'One', targetMinutes: 45, items: [item('a'), item('b'), item('c')] },
  { id: 's2', name: 'Two', targetMinutes: 60, items: [item('d'), item('e')] },
]

describe('moveItem', () => {
  it('reorders within a session', () => {
    expect(ids(moveItem(sessions, 'a', 's1', 2))).toEqual([['b', 'c', 'a'], ['d', 'e']])
  })
  it('moves across sessions', () => {
    expect(ids(moveItem(sessions, 'b', 's2', 1))).toEqual([['a', 'c'], ['d', 'b', 'e']])
  })
  it('clamps the index and leaves the input untouched', () => {
    expect(ids(moveItem(sessions, 'a', 's2', 99))).toEqual([['b', 'c'], ['d', 'e', 'a']])
    expect(ids(sessions)).toEqual([['a', 'b', 'c'], ['d', 'e']])
  })
})

describe('swapItems', () => {
  it('swaps within and across sessions', () => {
    expect(ids(swapItems(sessions, 'a', 'c'))).toEqual([['c', 'b', 'a'], ['d', 'e']])
    expect(ids(swapItems(sessions, 'b', 'e'))).toEqual([['a', 'e', 'c'], ['d', 'b']])
  })
  it('ignores unknown ids', () => {
    expect(swapItems(sessions, 'a', 'zzz')).toBe(sessions)
  })
})

describe('arrangeByBpm', () => {
  const songs = { a: song('a', 120), b: song('b', 80), c: song('c', null), d: song('d', 100), e: song('e', 140) }
  const list = ['a', 'b', 'c', 'd', 'e'].map((id) => item(id))
  const order = (mode: 'build' | 'cooldown' | 'mountain') => arrangeByBpm(list, songs, mode).map((i) => i.id)

  it('builds, cools down, and peaks in the middle, unknown BPM last', () => {
    expect(order('build')).toEqual(['b', 'd', 'a', 'e', 'c'])
    expect(order('cooldown')).toEqual(['e', 'a', 'd', 'b', 'c'])
    expect(order('mountain')).toEqual(['b', 'a', 'e', 'd', 'c'])
  })
})

describe('warnings', () => {
  it('flags key clashes using the performed (transposed) key', () => {
    const songs = { a: song('a', 100, 'C'), b: song('b', 100, 'G'), c: song('c', 100, 'F#') }
    expect([...keyClashes([item('a'), item('b'), item('c')], songs)]).toEqual(['c'])
    // Transposing F# down 5 gives C♯… still a clash; down 6 gives C, which is fine after G.
    expect([...keyClashes([item('a'), item('b'), item('c', null, -6)], songs)]).toEqual([])
  })

  it('flags a singer with more than three in a row', () => {
    const list = ['k', 'k', 'k', 'k', 'd', 'k'].map((s, i) => item(`i${i}`, s))
    expect([...singerOverload(list)]).toEqual(['i3'])
  })
})

describe('durations', () => {
  it('totals a session and formats times', () => {
    const songs = { a: song('a', 1, null, 200), b: song('b', 1, null, 245) }
    expect(sessionDurationSec({ id: 'x', name: '', targetMinutes: 0, items: [item('a'), item('b')] }, songs)).toBe(445)
    expect(formatDuration(245)).toBe('4:05')
    expect(formatDuration(3 * 3600 + 120)).toBe('3h 02m')
  })
})
