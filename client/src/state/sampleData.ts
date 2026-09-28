import { parseKey } from '../lib/music'
import type { BandState, Song } from '../lib/types'

const song = (
  id: string, title: string, artist: string, youtubeId: string | null,
  durationSec: number, bpm: number | null, key: string | null,
): Song => ({
  id, title, artist, youtubeId, durationSec, bpm,
  key: key ? parseKey(key) : null, bpmSource: bpm ? 'lookup' : null,
})

const songs: Song[] = [
  song('perfect', 'Perfect', 'Ed Sheeran', '2Vv-BfVoq4g', 263, 95, 'Ab major'),
  song('mal-mitak', 'Mal Mitak Thiyanna', 'Nirosha Virajini', null, 240, 84, 'D major'),
  song('thinking', 'Thinking Out Loud', 'Ed Sheeran', 'lp-EO5I60KA', 281, 79, 'D major'),
  song('sanda-kan', 'Sanda Kan Eliye', '', null, 250, null, 'A minor'),
  song('uptown', 'Uptown Funk', 'Mark Ronson ft. Bruno Mars', 'OPf0YbXqDm0', 270, 115, 'D minor'),
  song('dancing-queen', 'Dancing Queen', 'ABBA', 'xFrGuyw1V8s', 231, 101, 'A major'),
  song('baila', 'Baila Medley', 'Various', null, 420, 128, 'G major'),
  song('shape', 'Shape of You', 'Ed Sheeran', 'JGwWNGJdvx8', 234, 96, 'C# minor'),
  song('caroline', 'Sweet Caroline', 'Neil Diamond', null, 203, 128, 'B major'),
]

const item = (songId: string, singerId: string | null) => ({
  id: `item-${songId}`, songId, singerId, transpose: 0, notes: '',
})

export const sampleState: BandState = {
  bandName: 'FASTUNES',
  members: [
    { id: 'm-lapalu', name: 'Lapalu', role: 'manager', isSinger: false },
    { id: 'm-kasun', name: 'Kasun', role: 'editor', isSinger: true },
    { id: 'm-dilini', name: 'Dilini', role: 'viewer', isSinger: true },
    { id: 'm-ravindu', name: 'Ravindu', role: 'viewer', isSinger: true },
  ],
  songs: Object.fromEntries(songs.map((s) => [s.id, s])),
  shows: [
    {
      id: 'show-sample',
      name: 'Hilton Colombo – Wedding Reception (sample)',
      date: '2026-10-18',
      venue: 'Hilton Colombo',
      slotMinutes: 150,
      sessions: [
        {
          id: 'sess-dinner', name: 'Dinner', targetMinutes: 45,
          items: [item('perfect', 'm-dilini'), item('mal-mitak', 'm-dilini'), item('thinking', 'm-kasun'), item('sanda-kan', 'm-kasun')],
        },
        {
          id: 'sess-dance', name: 'Dance', targetMinutes: 60,
          items: [item('uptown', 'm-ravindu'), item('dancing-queen', 'm-dilini'), item('baila', 'm-ravindu'), item('shape', 'm-kasun')],
        },
        { id: 'sess-encore', name: 'Encore', targetMinutes: 10, items: [item('caroline', null)] },
      ],
    },
  ],
  activeShowId: 'show-sample',
}
