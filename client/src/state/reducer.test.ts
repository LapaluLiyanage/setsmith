import { describe, expect, it } from 'vitest'
import { historyReducer, signature, type HistoryState } from './reducer'
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

describe('sync helpers', () => {
  it('replace swaps the state and clears undo history', () => {
    const edited = historyReducer(start, { type: 'swapItems', aId: 'item-perfect', bId: 'item-thinking' })
    const replaced = historyReducer(edited, { type: 'replace', state: sampleState })
    expect(replaced.present).toBe(sampleState)
    expect(replaced.past).toHaveLength(0)
  })

  it('signature ignores show selection but sees real edits', () => {
    const other = { ...sampleState, activeShowId: 'somewhere-else' }
    expect(signature(other)).toBe(signature(sampleState))
    const edited = historyReducer(start, { type: 'swapItems', aId: 'item-perfect', bId: 'item-thinking' })
    expect(signature(edited.present)).not.toBe(signature(sampleState))
  })

  it('stores a singer key range on a member', () => {
    const next = historyReducer(start, { type: 'updateMember', memberId: 'm-dilini', patch: { keyRange: { from: 2, to: 7 } } })
    expect(next.present.members.find((m) => m.id === 'm-dilini')?.keyRange).toEqual({ from: 2, to: 7 })
  })
})
