import { describe, expect, it } from 'vitest'
import { sampleState } from '../state/sampleData'
import { asciiKey, buildExport, pdfFileName, toShareText } from './exportData'
import { parseKey } from './music'

const show = sampleState.shows[0]

describe('buildExport', () => {
  const data = buildExport(show, sampleState.songs, sampleState.members, 'FASTUNES')

  it('summarises the show', () => {
    expect(data.songCount).toBe(9)
    expect(data.sessions.map((s) => s.name)).toEqual(['Dinner', 'Dance', 'Encore'])
    expect(data.slot).toBe('2h 30m')
    expect(data.date).toMatch(/18 Oct 2026/)
  })

  it('fills each row with singer, BPM, ASCII key and link', () => {
    expect(data.sessions[0].rows[0]).toMatchObject({
      number: 1, title: 'Perfect', singer: 'Dilini', bpm: '95', key: 'Ab', camelot: '4B',
      url: 'https://www.youtube.com/watch?v=2Vv-BfVoq4g',
    })
    // Sinhala song without a BPM or YouTube link yet.
    expect(data.sessions[0].rows[3]).toMatchObject({ bpm: '', url: null, key: 'Am' })
  })

  it('shows the played key when transposed', () => {
    const transposed = {
      ...show,
      sessions: [{ ...show.sessions[0], items: [{ ...show.sessions[0].items[2], transpose: -2 }] }],
    }
    const row = buildExport(transposed, sampleState.songs, sampleState.members, 'FASTUNES').sessions[0].rows[0]
    expect(row.key).toBe('C (orig. D, -2)')
  })

  it('counts songs per singer, busiest first', () => {
    expect(data.singerCounts).toEqual([
      { name: 'Dilini', count: 3 }, { name: 'Kasun', count: 3 }, { name: 'Ravindu', count: 2 },
    ])
  })

  it('flags sessions that run over their target', () => {
    const tight = { ...show, sessions: [{ ...show.sessions[0], targetMinutes: 10 }] }
    expect(buildExport(tight, sampleState.songs, [], 'X').sessions[0].over).toBe(true)
  })
})

describe('share text and file name', () => {
  const data = buildExport(show, sampleState.songs, sampleState.members, 'FASTUNES')
  it('lists songs with links for WhatsApp', () => {
    const text = toShareText(data)
    expect(text).toContain('*Dinner* (17:14)')
    expect(text).toContain('1. Perfect – Ed Sheeran [Dilini · 95 BPM · Ab]')
    expect(text).toContain('   https://www.youtube.com/watch?v=2Vv-BfVoq4g')
  })
  it('makes a safe file name', () => {
    expect(pdfFileName(data)).toBe('setlist-hilton-colombo-wedding-reception-sample.pdf')
  })
  it('writes keys in ASCII', () => {
    expect(asciiKey(parseKey('C# minor')!)).toBe('C#m')
    expect(asciiKey(parseKey('Bb')!)).toBe('Bb')
  })
})
