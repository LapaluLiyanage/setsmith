import { NOTE_ALIASES, NOTE_NAMES } from './music'

/** Chord suffixes we recognise, longest first so e.g. "maj7" wins over "maj". */
const QUALITY =
  'maj7|maj9|maj13|maj|mmaj7|madd9|m7b5|m7#5|min7|min|m6|m7|m9|m11|m13|m|' +
  'dim7|dim|aug|sus4|sus2|sus|add9|add11|add2|add4|M7|M9|M11|M13|M|Δ7|Δ|ø7|ø|alt|5|6|7|9|11|13|2|4|' +
  '[#b♯♭](?:5|9|11|13)|\\([#b♯♭+-]?(?:add)?\\d+\\)|\\(maj7\\)|\\+|°'

/** Any number of slash-bass parts, each a note with optional quality and parentheses: "/E", "/Fmaj7", "/E/Am", "/(Dm7)". */
const BASS = `(?:/\\(?[A-G][#b♯♭]?(?:${QUALITY})*\\)?)*`
const CHORD_RE = new RegExp(`^([A-G])([#b♯♭]?)((?:${QUALITY})*)(${BASS})$`)

/** A section label like "Intro:" at the start of a line, kept as-is. */
const LABEL_RE = /^[A-Za-z]+:$/
/** Repeat counts and bar separators in a chord line, e.g. "x4", "×2", "|", "--", "-", kept as-is. */
const DECORATION_RE = /^(x\d+|×\d+|\|+|-+|\/+|\++|N\.?C\.?|%)$/i

/** A chord, optionally wrapped in brackets as a note to the player ("(G/G#/Am)"), or typed with a
 * lowercase root and a quality ("cm" for Cm). A bare lowercase letter is never a chord ("a", "e"). */
function chordCore(t: string): string | null {
  const core = t.length > 2 && t.startsWith('(') && t.endsWith(')') ? t.slice(1, -1) : t
  if (CHORD_RE.test(core)) return core
  if (core.length > 1 && /^[a-g]/.test(core)) {
    const cap = core[0].toUpperCase() + core.slice(1)
    if (CHORD_RE.test(cap)) return cap
  }
  return null
}

/** Splits a whitespace-delimited token into its bar/dash decorations and chord-ish pieces, so
 * e.g. "|F#m" (a bar butted up against the chord, common in intro/interlude bar notation) becomes
 * ["|", "F#m"] instead of failing to match as a chord at all. */
function splitBarToken(token: string): string[] {
  return token.split(/(\|+|-+)/).filter(Boolean)
}

function shiftNote(letter: string, accidental: string, semitones: number): string {
  const key = (letter + accidental).toUpperCase().replace('♯', '#').replace('♭', 'b')
  const idx = NOTE_ALIASES[key]
  if (idx === undefined) return letter + accidental
  return NOTE_NAMES[((idx + semitones) % 12 + 12) % 12]
}

/** Transpose one chord token, e.g. "G", "F#m7", "Bb/D". Leaves anything that isn't a chord untouched. */
export function transposeChord(token: string, semitones: number): string {
  if (semitones === 0) return token
  const wrapped = token.length > 2 && token.startsWith('(') && token.endsWith(')')
  if (wrapped && chordCore(token)) return `(${transposeChord(token.slice(1, -1), semitones)})`
  const lower = /^[a-g]/.test(token)
  const m = CHORD_RE.exec(lower ? token[0].toUpperCase() + token.slice(1) : token)
  if (!m) return token
  const [, letter, acc, quality, bass] = m
  const root = shiftNote(letter, acc, semitones)
  const newBass = bass.replace(/(?<=\/\(?)([A-G])([#b♯♭]?)/g, (_, l: string, a: string) => shiftNote(l, a, semitones))
  const out = root + quality + newBass
  return lower ? out[0].toLowerCase() + out.slice(1) : out
}

/** True when the line is a ChordPro-style chord line (allowing a leading section label like
 * "Intro:", and bar/repeat marks like "|" or "x4"), rather than lyrics. */
export function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  const body = LABEL_RE.test(tokens[0]) ? tokens.slice(1) : tokens
  const pieces = body.flatMap(splitBarToken)
  return pieces.length > 0
    && pieces.some((t) => CHORD_RE.test(t))
    && pieces.every((t) => chordCore(t) !== null || DECORATION_RE.test(t))
}

/** Transpose a chord sheet: chords on chord lines are shifted (labels, bars and repeat counts pass through); lyric lines are untouched. */
export function transposeChordSheet(sheet: string, semitones: number): string {
  if (!sheet || semitones === 0) return sheet
  return sheet
    .split('\n')
    .map((line) => (isChordLine(line)
      ? line.replace(/\S+/g, (t) => splitBarToken(t).map((p) => transposeChord(p, semitones)).join(''))
      : line))
    .join('\n')
}
