import { describe, expect, it } from 'vitest'
import { historyReducer, type HistoryState } from './reducer'
import { sampleState } from './sampleData'

const start: HistoryState = { present: sampleState, past: [] }
const dinnerIds = (h: HistoryState) => h.present.shows[0].sessions[0].items.map((i) => i.songId)

describe('historyReducer', () => {
  it('swaps and undoes', () => {
    const swapped = historyReducer(start, { type: 'swapItems', aId: 'item-perfect', bId: 'item-thinking' })
    expect(dinnerIds(swapped)).toEqual(['thinking', 'mal-mitak', 'perfect', 'sanda-kan'])
    const undone = historyReducer(swapped, { type: 'undo' })
    expect(dinnerIds(undone)).toEqual(['perfect', 'mal-mitak', 'thinking', 'sanda-kan'])
    expect(undone.past).toHaveLength(0)
  })

  it('does not record show selection in undo history', () => {
    const selected = historyReducer(start, { type: 'selectShow', showId: 'show-sample' })
    expect(selected.past).toHaveLength(0)
  })

  it('unassigns songs when a singer is removed', () => {
    const next = historyReducer(start, { type: 'removeMember', memberId: 'm-dilini' })
    const singers = next.present.shows[0].sessions[0].items.map((i) => i.singerId)
    expect(singers).toEqual([null, null, 'm-kasun', 'm-kasun'])
  })

  it('arranges a session by BPM, unknown tempo last', () => {
    const next = historyReducer(start, { type: 'arrange', sessionId: 'sess-dinner', mode: 'build' })
    expect(dinnerIds(next)).toEqual(['thinking', 'mal-mitak', 'perfect', 'sanda-kan'])
  })
})
