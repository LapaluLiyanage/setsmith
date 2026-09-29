import { NOTE_ALIASES, NOTE_NAMES } from './music'

/** Chord suffixes we recognise, longest first so e.g. "maj7" wins over "maj". */
const QUALITY =
  'maj7|maj9|maj13|maj|mmaj7|madd9|m7b5|m7#5|min7|min|m6|m7|m9|m11|m13|m|' +
  'dim7|dim|aug|sus4|sus2|sus|add9|add11|add2|6|7|9|11|13|b5|#5|b9|#9|\\+|°'

const CHORD_RE = new RegExp(`^([A-G])([#b♯♭]?)((?:${QUALITY})*)(?:/([A-G])([#b♯♭]?))?$`)

/** A section label like "Intro:" at the start of a line, kept as-is. */
const LABEL_RE = /^[A-Za-z]+:$/
/** Repeat counts and bar separators in a chord line, e.g. "x4", "×2", "|", "--", kept as-is. */
const DECORATION_RE = /^(x\d+|×\d+|\|+|-{2,})$/i

function shiftNote(letter: string, accidental: string, semitones: number): string {
  const key = (letter + accidental).toUpperCase().replace('♯', '#').replace('♭', 'b')
  const idx = NOTE_ALIASES[key]
  if (idx === undefined) return letter + accidental
  return NOTE_NAMES[((idx + semitones) % 12 + 12) % 12]
}

/** Transpose one chord token, e.g. "G", "F#m7", "Bb/D". Leaves anything that isn't a chord untouched. */
export function transposeChord(token: string, semitones: number): string {
  if (semitones === 0) return token
  const m = CHORD_RE.exec(token)
  if (!m) return token
  const [, letter, acc, quality, bassLetter, bassAcc] = m
  const root = shiftNote(letter, acc, semitones)
  const bass = bassLetter ? shiftNote(bassLetter, bassAcc, semitones) : null
  return root + quality + (bass ? `/${bass}` : '')
}

/** True when the line is a ChordPro-style chord line (allowing a leading section label like
 * "Intro:", and bar/repeat marks like "|" or "x4"), rather than lyrics. */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  const body = LABEL_RE.test(tokens[0]) ? tokens.slice(1) : tokens
  return body.length > 0
    && body.some((t) => CHORD_RE.test(t))
    && body.every((t) => CHORD_RE.test(t) || DECORATION_RE.test(t))
}

/** Transpose a chord sheet: chords on chord lines are shifted (labels, bars and repeat counts pass through); lyric lines are untouched. */
export function transposeChordSheet(sheet: string, semitones: number): string {
  if (!sheet || semitones === 0) return sheet
  return sheet
    .split('\n')
    .map((line) => (isChordLine(line) ? line.replace(/\S+/g, (t) => transposeChord(t, semitones)) : line))
    .join('\n')
}
