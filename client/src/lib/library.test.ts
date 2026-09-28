import { describe, expect, it } from 'vitest'
import { sampleState } from '../state/sampleData'
import { buildLibrary, filterLibrary, filtersActive, NO_FILTERS, songLang } from './library'

const rows = buildLibrary(sampleState)
const titles = (f: Partial<typeof NO_FILTERS>) => filterLibrary(rows, { ...NO_FILTERS, ...f }).map((r) => r.song.title)

describe('buildLibrary', () => {
  it('lists every song A to Z with its usual singer and show count', () => {
    expect(rows).toHaveLength(9)
    expect(rows[0].song.title).toBe('Baila Medley')
    const perfect = rows.find((r) => r.song.id === 'perfect')!
    expect(perfect).toMatchObject({ singerId: 'm-dilini', played: 1, camelot: '4B', lang: 'EN' })
    expect(rows.find((r) => r.song.id === 'caroline')!.singerId).toBeNull()
  })

  it('picks the singer who sings a song most often', () => {
    const state = structuredClone(sampleState)
    const dance = state.shows[0].sessions[1]
    dance.items.push({ id: 'x1', songId: 'perfect', singerId: 'm-kasun', transpose: 0, notes: '' })
    dance.items.push({ id: 'x2', songId: 'perfect', singerId: 'm-kasun', transpose: 0, notes: '' })
    expect(buildLibrary(state).find((r) => r.song.id === 'perfect')!.singerId).toBe('m-kasun')
  })
})

describe('songLang', () => {
  it('uses the saved language, else the script of the title', () => {
    const base = sampleState.songs.perfect
    expect(songLang({ ...base, lang: 'SI' })).toBe('SI')
    expect(songLang({ ...base, lang: undefined, title: 'මල් මිටක්' })).toBe('SI')
    expect(songLang({ ...base, lang: undefined })).toBe('EN')
  })
})

describe('filterLibrary', () => {
  it('searches title and artist', () => {
    expect(titles({ query: 'sheeran' })).toEqual(['Perfect', 'Shape of You', 'Thinking Out Loud'])
    expect(titles({ query: 'MAL' })).toEqual(['Mal Mitak Thiyanna'])
  })
  it('filters by singer, including unassigned', () => {
    expect(titles({ singerId: 'm-ravindu' })).toEqual(['Baila Medley', 'Uptown Funk'])
    expect(titles({ singerId: 'none' })).toEqual(['Sweet Caroline'])
  })
  it('filters by language', () => {
    expect(titles({ lang: 'SI' })).toEqual(['Baila Medley', 'Mal Mitak Thiyanna', 'Sanda Kan Eliye'])
  })
  it('filters by BPM range and drops unknown tempos once narrowed', () => {
    expect(titles({ bpmMin: 100, bpmMax: 120 })).toEqual(['Dancing Queen', 'Uptown Funk'])
    expect(titles({})).toContain('Sanda Kan Eliye')
    expect(titles({ bpmMax: 179 })).not.toContain('Sanda Kan Eliye')
  })
  it('filters by Camelot number', () => {
    expect(titles({ keyNumber: 10 })).toEqual(['Mal Mitak Thiyanna', 'Thinking Out Loud'])
  })
  it('knows when any filter is on', () => {
    expect(filtersActive(NO_FILTERS)).toBe(false)
    expect(filtersActive({ ...NO_FILTERS, query: '  ' })).toBe(false)
    expect(filtersActive({ ...NO_FILTERS, lang: 'EN' })).toBe(true)
  })
})
