import { describe, expect, it } from 'vitest'
import { sampleState } from '../state/sampleData'
import { beatSeconds, buildStageList } from './stage'

const show = sampleState.shows[0]

describe('buildStageList', () => {
  const list = buildStageList(show, sampleState.songs, sampleState.members)

  it('runs through every session in order', () => {
    expect(list.map((s) => s.title)).toEqual([
      'Perfect', 'Mal Mitak Thiyanna', 'Thinking Out Loud', 'Sanda Kan Eliye',
      'Uptown Funk', 'Dancing Queen', 'Baila Medley', 'Shape of You', 'Sweet Caroline',
    ])
    expect(list.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('knows where each song sits in its session', () => {
    expect(list[5]).toMatchObject({ sessionName: 'Dance', inSession: 2, sessionSize: 4 })
  })

  it('shows singer, played key, Camelot and BPM', () => {
    expect(list[0]).toMatchObject({ key: 'A♭ major', camelot: '4B', bpm: 95, duration: '4:23', transposeNote: null })
    expect(list[0].singer.name).toBe('Dilini')
    expect(list[8].singer.name).toBe('No singer')
  })

  it('uses the transposed key and says so', () => {
    const t = { ...show, sessions: [{ ...show.sessions[1], items: [{ ...show.sessions[1].items[1], transpose: -2 }] }] }
    const [song] = buildStageList(t, sampleState.songs, sampleState.members)
    expect(song).toMatchObject({ key: 'G major', camelot: '9B', transposeNote: 'play in G (−2)' })
  })
})

describe('beatSeconds', () => {
  it('matches the tempo, with a fallback', () => {
    expect(beatSeconds(120)).toBe(0.5)
    expect(beatSeconds(null)).toBe(1)
  })
})
