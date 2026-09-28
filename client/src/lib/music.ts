import type { MusicalKey } from './types'

export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const

const NOTE_ALIASES: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, DB: 1, D: 2, 'D#': 3, EB: 3, E: 4, FB: 4, F: 5, 'E#': 5,
  'F#': 6, GB: 6, G: 7, 'G#': 8, AB: 8, A: 9, 'A#': 10, BB: 10, B: 11, CB: 11,
}

export function formatKey(key: MusicalKey): string {
  return `${NOTE_NAMES[key.tonic]} ${key.mode}`
}

/**
 * Parse loose key text such as "A minor", "Am", "F#m", "Eb major", "C♯ min".
 * Returns null when the text isn't a recognisable key.
 */
export function parseKey(text: string): MusicalKey | null {
  const cleaned = text.trim().replace(/♯/g, '#').replace(/♭/g, 'b')
  const match = /^([A-Ga-g])([#b]?)\s*(major|maj|minor|min|m)?$/i.exec(cleaned)
  if (!match) return null
  const [, letter, accidental, modeText] = match
  const tonic = NOTE_ALIASES[(letter + accidental).toUpperCase()]
  if (tonic === undefined) return null
  const mode = modeText && /^m(in(or)?)?$/i.test(modeText) && modeText !== 'M' ? 'minor' : 'major'
  return { tonic, mode }
}

/** Camelot wheel code, e.g. A minor → "8A", C major → "8B". */
export function camelot(key: MusicalKey): string {
  // Major keys step around the wheel by fifths; C major sits at 8.
  // A minor key shares its number with its relative major (tonic + 3).
  const majorTonic = key.mode === 'major' ? key.tonic : (key.tonic + 3) % 12
  const number = ((majorTonic * 7 + 7) % 12) + 1
  return `${number}${key.mode === 'minor' ? 'A' : 'B'}`
}

function camelotParts(key: MusicalKey): { number: number; letter: string } {
  const code = camelot(key)
  return { number: Number(code.slice(0, -1)), letter: code.slice(-1) }
}

/**
 * True when two keys mix smoothly: same key, relative major/minor,
 * or one step around the wheel with the same letter.
 */
export function keysCompatible(a: MusicalKey, b: MusicalKey): boolean {
  const pa = camelotParts(a)
  const pb = camelotParts(b)
  if (pa.number === pb.number) return true
  if (pa.letter !== pb.letter) return false
  const diff = Math.abs(pa.number - pb.number)
  return diff === 1 || diff === 11
}

export function transposeKey(key: MusicalKey, semitones: number): MusicalKey {
  return { tonic: (((key.tonic + semitones) % 12) + 12) % 12, mode: key.mode }
}
