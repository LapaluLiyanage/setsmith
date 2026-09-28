import { describe, expect, it } from 'vitest'
import { camelot, formatKey, inRange, keysCompatible, parseKey, suggestTranspose, transposeKey } from './music'

describe('parseKey', () => {
  it.each([
    ['A minor', { tonic: 9, mode: 'minor' }],
    ['Am', { tonic: 9, mode: 'minor' }],
    ['F#m', { tonic: 6, mode: 'minor' }],
    ['C♯ min', { tonic: 1, mode: 'minor' }],
    ['Eb major', { tonic: 3, mode: 'major' }],
    ['G♭', { tonic: 6, mode: 'major' }],
    ['D', { tonic: 2, mode: 'major' }],
  ])('parses %s', (text, expected) => {
    expect(parseKey(text)).toEqual(expected)
  })

  it('rejects nonsense', () => {
    expect(parseKey('H minor')).toBeNull()
    expect(parseKey('')).toBeNull()
  })
})

describe('camelot', () => {
  it.each([
    ['C major', '8B'], ['A minor', '8A'], ['G major', '9B'], ['E minor', '9A'],
    ['B major', '1B'], ['A♭ minor', '1A'], ['E major', '12B'], ['C♯ minor', '12A'],
    ['D minor', '7A'], ['F♯ major', '2B'],
  ])('%s → %s', (text, code) => {
    expect(camelot(parseKey(text)!)).toBe(code)
  })
})

describe('keysCompatible', () => {
  const k = (t: string) => parseKey(t)!
  it('accepts same key, relative, and neighbours', () => {
    expect(keysCompatible(k('C'), k('C'))).toBe(true)
    expect(keysCompatible(k('C'), k('Am'))).toBe(true)
    expect(keysCompatible(k('C'), k('G'))).toBe(true)
    expect(keysCompatible(k('B'), k('E'))).toBe(true) // 1B ↔ 12B wraps round
  })
  it('flags big jumps', () => {
    expect(keysCompatible(k('C'), k('F#'))).toBe(false)
    expect(keysCompatible(k('C'), k('Em'))).toBe(false) // 8B → 9A changes number and letter
  })
})

describe('transposeKey', () => {
  it('wraps both directions', () => {
    expect(formatKey(transposeKey(parseKey('C')!, -2))).toBe('B♭ major')
    expect(formatKey(transposeKey(parseKey('B')!, 2))).toBe('C♯ major')
  })
})

describe('suggestTranspose', () => {
  const C = parseKey('C')!
  it('returns null with no range, no key, or when already comfortable', () => {
    expect(suggestTranspose(C, 0, undefined)).toBeNull()
    expect(suggestTranspose(null, 0, { from: 0, to: 4 })).toBeNull()
    expect(suggestTranspose(C, 0, { from: 0, to: 4 })).toBeNull()
  })
  it('finds the smallest shift, preferring up on ties', () => {
    expect(suggestTranspose(C, 0, { from: 2, to: 5 })).toBe(2) // C -> D
    expect(suggestTranspose(C, 0, { from: 8, to: 10 })).toBe(-2) // C -> B flat
  })
  it('accounts for current transpose and wraps ranges', () => {
    expect(suggestTranspose(C, 1, { from: 10, to: 1 })).toBeNull() // C# inside A#..C#
    expect(inRange(11, { from: 10, to: 1 })).toBe(true)
    expect(inRange(5, { from: 10, to: 1 })).toBe(false)
  })
})
