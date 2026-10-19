import { describe, expect, it } from 'vitest'
import { fitWithin, isShowEnded } from './showPhotos'

describe('isShowEnded', () => {
  const now = new Date(2026, 9, 20, 15, 0)
  it('is true only for dates before today', () => {
    expect(isShowEnded('2026-10-19', now)).toBe(true)
    expect(isShowEnded('2026-10-20', now)).toBe(false)
    expect(isShowEnded('2026-10-21', now)).toBe(false)
  })
  it('ignores a missing or malformed date', () => {
    expect(isShowEnded('', now)).toBe(false)
    expect(isShowEnded('soon', now)).toBe(false)
  })
})

describe('fitWithin', () => {
  it('scales the longest side down to the limit', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })
  it('never scales up', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
})
