import { describe, expect, it } from 'vitest'
import { isChordLine, transposeChord, transposeChordSheet } from './chordSheet'

describe('transposeChord', () => {
  it('shifts a plain major chord', () => {
    expect(transposeChord('G', 2)).toBe('A')
  })

  it('keeps the quality suffix', () => {
    expect(transposeChord('F#m7', 1)).toBe('Gm7')
    expect(transposeChord('Cmaj7', -1)).toBe('Bmaj7')
  })

  it('shifts a slash chord bass note too', () => {
    expect(transposeChord('G/B', 2)).toBe('A/C♯')
  })

  it('wraps around the octave both ways', () => {
    expect(transposeChord('B', 2)).toBe('C♯')
    expect(transposeChord('C', -1)).toBe('B')
  })

  it('leaves non-chord text alone', () => {
    expect(transposeChord('Amazing', 2)).toBe('Amazing')
  })

  it('is a no-op at zero semitones', () => {
    expect(transposeChord('G', 0)).toBe('G')
  })
})

describe('isChordLine', () => {
  it('accepts a line of chords', () => {
    expect(isChordLine('G       D/F#      Em7')).toBe(true)
  })

  it('rejects a lyric line', () => {
    expect(isChordLine('Amazing grace how sweet the sound')).toBe(false)
  })

  it('rejects a blank line', () => {
    expect(isChordLine('   ')).toBe(false)
  })

  it('accepts a chord line with a leading section label', () => {
    expect(isChordLine('Intro: G D Em C')).toBe(true)
    expect(isChordLine('Interlude:')).toBe(false) // label with no chords isn't a chord line
  })

  it('accepts bar separators and repeat counts alongside chords', () => {
    expect(isChordLine('| G | D | Em | C |')).toBe(true)
    expect(isChordLine('G D x4')).toBe(true)
  })
})

describe('transposeChordSheet', () => {
  const sheet = 'G           D\nAmazing grace how sweet\nEm          C\nthat saved a wretch like me'

  it('shifts only the chord lines', () => {
    expect(transposeChordSheet(sheet, 2)).toBe(
      'A           E\nAmazing grace how sweet\nF♯m          D\nthat saved a wretch like me',
    )
  })

  it('returns the sheet unchanged at zero semitones', () => {
    expect(transposeChordSheet(sheet, 0)).toBe(sheet)
  })

  it('handles a missing sheet', () => {
    expect(transposeChordSheet('', 3)).toBe('')
  })

  it('transposes an intro/interlude line, keeping the label and repeat count as-is', () => {
    const withIntro = 'Intro: G D Em C x2\nAmazing grace how sweet\nEm          C\nthat saved a wretch like me'
    expect(transposeChordSheet(withIntro, 2)).toBe(
      'Intro: A E F♯m D x2\nAmazing grace how sweet\nF♯m          D\nthat saved a wretch like me',
    )
  })

  it('transposes chords inside bar separators', () => {
    expect(transposeChordSheet('| G | D | Em | C |', 2)).toBe('| A | E | F♯m | D |')
  })
})
