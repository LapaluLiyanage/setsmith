import { NOTE_ALIASES, NOTE_NAMES } from './music'

/** Chord suffixes we recognise, longest first so e.g. "maj7" wins over "maj". */
const QUALITY =
  'maj7|maj9|maj13|maj|mmaj7|madd9|m7b5|m7#5|min7|min|m6|m7|m9|m11|m13|m|' +
  'dim7|dim|aug|sus4|sus2|sus|add9|add11|add2|6|7|9|11|13|b5|#5|b9|#9|\\+|°'

const CHORD_RE = new RegExp(`^([A-G])([#b♯♭]?)((?:${QUALITY})*)(?:/([A-G])([#b♯♭]?))?$`)

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

/** True when every token on the line is a recognised chord (a ChordPro-style chord line, not lyrics). */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  return tokens.length > 0 && tokens.every((t) => CHORD_RE.test(t))
}

/** Transpose a chord sheet: chord-only lines get every token shifted; lyric lines pass through untouched. */
export function transposeChordSheet(sheet: string, semitones: number): string {
  if (!sheet || semitones === 0) return sheet
  return sheet
    .split('\n')
    .map((line) => (isChordLine(line) ? line.replace(/\S+/g, (t) => transposeChord(t, semitones)) : line))
    .join('\n')
}
