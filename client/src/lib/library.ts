import { camelot, transposeKey } from './music'
import type { BandState, Lang, Song } from './types'

export interface LibraryRow {
  song: Song
  lang: Lang
  /** Member who most often sings it across all shows, if anyone has. */
  singerId: string | null
  /** Number of shows it is in. */
  played: number
  camelot: string | null
}

export interface LibraryFilters {
  query: string
  singerId: string | 'none' | null
  lang: Lang | null
  bpmMin: number
  bpmMax: number
  /** Camelot number 1-12 (matches both A and B). */
  keyNumber: number | null
}

export const BPM_FLOOR = 60
export const BPM_CEIL = 180
export const NO_FILTERS: LibraryFilters = { query: '', singerId: null, lang: null, bpmMin: BPM_FLOOR, bpmMax: BPM_CEIL, keyNumber: null }

const SINHALA = /[\u0D80-\u0DFF]/

export const songLang = (song: Song): Lang => song.lang ?? (SINHALA.test(`${song.title}${song.artist}`) ? 'SI' : 'EN')

export function buildLibrary(state: BandState): LibraryRow[] {
  const sung = new Map<string, Map<string, number>>()
  const shows = new Map<string, Set<string>>()
  for (const show of state.shows) {
    for (const session of show.sessions) {
      for (const item of session.items) {
        if (!shows.has(item.songId)) shows.set(item.songId, new Set())
        shows.get(item.songId)!.add(show.id)
        if (!item.singerId) continue
        const counts = sung.get(item.songId) ?? new Map<string, number>()
        counts.set(item.singerId, (counts.get(item.singerId) ?? 0) + 1)
        sung.set(item.songId, counts)
      }
    }
  }
  const memberIds = new Set(state.members.map((m) => m.id))
  return Object.values(state.songs)
    .map((song) => {
      const counts = [...(sung.get(song.id) ?? [])].filter(([id]) => memberIds.has(id))
      counts.sort((a, b) => b[1] - a[1])
      return {
        song,
        lang: songLang(song),
        singerId: counts[0]?.[0] ?? null,
        played: shows.get(song.id)?.size ?? 0,
        camelot: song.key ? camelot(transposeKey(song.key, 0)) : null,
      }
    })
    .sort((a, b) => a.song.title.localeCompare(b.song.title))
}

const bpmIsFiltered = (f: LibraryFilters) => f.bpmMin > BPM_FLOOR || f.bpmMax < BPM_CEIL

export function filterLibrary(rows: LibraryRow[], f: LibraryFilters): LibraryRow[] {
  const q = f.query.trim().toLowerCase()
  return rows.filter((r) => {
    if (q && !`${r.song.title} ${r.song.artist}`.toLowerCase().includes(q)) return false
    if (f.singerId === 'none' ? r.singerId !== null : f.singerId && r.singerId !== f.singerId) return false
    if (f.lang && r.lang !== f.lang) return false
    // A range narrower than the full span hides songs whose tempo we don't know.
    if (bpmIsFiltered(f) && (r.song.bpm == null || r.song.bpm < f.bpmMin || r.song.bpm > f.bpmMax)) return false
    if (f.keyNumber && Number(r.camelot?.slice(0, -1)) !== f.keyNumber) return false
    return true
  })
}

export const filtersActive = (f: LibraryFilters) =>
  JSON.stringify({ ...f, query: f.query.trim() }) !== JSON.stringify(NO_FILTERS)
