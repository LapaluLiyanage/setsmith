import { describe, expect, it } from 'vitest'
import { addTap, bpmFromTaps } from './tapTempo'

describe('tap tempo', () => {
  it('averages steady taps', () => {
    let taps: number[] = []
    for (let t = 0; t <= 2000; t += 500) taps = addTap(taps, t) // 500 ms apart = 120 BPM
    expect(bpmFromTaps(taps)).toBe(120)
  })

  it('needs two taps', () => {
    expect(bpmFromTaps(addTap([], 0))).toBeNull()
  })

  it('starts over after a long pause', () => {
    const taps = addTap([0, 500, 1000], 5000)
    expect(taps).toEqual([5000])
  })

  it('keeps only recent taps', () => {
    let taps: number[] = []
    for (let i = 0; i < 20; i++) taps = addTap(taps, i * 600)
    expect(taps).toHaveLength(8)
    expect(bpmFromTaps(taps)).toBe(100)
  })
})
