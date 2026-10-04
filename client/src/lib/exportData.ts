import { camelot, transposeKey } from './music'
import { formatDuration, sessionDurationSec } from './setlist'
import type { Member, MusicalKey, Show, Song } from './types'
import { watchUrl } from './youtube'

// ASCII note names: the PDF's built-in fonts have no ♯/♭ glyphs, and plain text pastes cleanly into WhatsApp.
const ASCII_NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export function asciiKey(key: MusicalKey): string {
  return `${ASCII_NOTES[key.tonic]}${key.mode === 'minor' ? 'm' : ''}`
}

export interface ExportRow {
  number: number
  title: string
  artist: string
  singer: string
  bpm: string
  /** Key the band plays, e.g. "D" or "D (orig. E, -2)". */
  key: string
  camelot: string
  duration: string
  url: string | null
  notes: string
}

export interface ExportSession {
  name: string
  rows: ExportRow[]
  total: string
  target: string
  over: boolean
}

export interface ExportData {
  bandName: string
  showName: string
  date: string
  venue: string
  planned: string
  slot: string
  songCount: number
  sessions: ExportSession[]
  singerCounts: { name: string; count: number }[]
}

export function formatShowDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function buildExport(show: Show, songs: Record<string, Song>, members: Member[], bandName: string): ExportData {
  const memberName = new Map(members.map((m) => [m.id, m.name]))
  const counts = new Map<string, number>()
  let totalSec = 0
  let songCount = 0

  const sessions = show.sessions.map((session): ExportSession => {
    const sec = sessionDurationSec(session, songs)
    totalSec += sec
    const rows = session.items.flatMap((item, i): ExportRow[] => {
      const song = songs[item.songId]
      if (!song) return []
      songCount++
      const singerName = item.singerId ? (memberName.get(item.singerId) ?? '') : ''
      const singer2Name = song.youtubeId2 && item.singerId2 ? (memberName.get(item.singerId2) ?? '') : ''
      const coNames = (item.coSingerIds ?? [])
        .filter((id) => id !== item.singerId)
        .map((id) => memberName.get(id) ?? '')
        .filter(Boolean)
      const names = [singerName, singer2Name, ...coNames].filter(Boolean)
      const singer = names.join(' & ')
      for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)

      let key = ''
      let code = ''
      if (song.key) {
        const played = transposeKey(song.key, item.transpose)
        code = camelot(played)
        key = item.transpose
          ? `${asciiKey(played)} (orig. ${asciiKey(song.key)}, ${item.transpose > 0 ? '+' : ''}${item.transpose})`
          : asciiKey(played)
      }
      return [{
        number: i + 1,
        title: song.title,
        artist: song.artist,
        singer,
        bpm: song.bpm ? String(song.bpm) : '',
        key,
        camelot: code,
        duration: song.durationSec ? formatDuration(song.durationSec) : '',
        url: song.youtubeId ? watchUrl(song.youtubeId) : null,
        notes: item.notes,
      }]
    })
    return {
      name: session.name,
      rows,
      total: formatDuration(sec),
      target: formatDuration(session.targetMinutes * 60),
      over: session.targetMinutes > 0 && sec > session.targetMinutes * 60,
    }
  })

  return {
    bandName,
    showName: show.name,
    date: formatShowDate(show.date),
    venue: show.venue,
    planned: formatDuration(totalSec),
    slot: formatDuration(show.slotMinutes * 60),
    songCount,
    sessions,
    singerCounts: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  }
}

/** Plain-text setlist for pasting into WhatsApp or an email body. */
export function toShareText(data: ExportData): string {
  const lines = [
    `*${data.showName}*`,
    [data.date, data.venue].filter(Boolean).join(' · '),
    `${data.songCount} songs · ${data.planned} planned (slot ${data.slot})`,
  ]
  for (const s of data.sessions) {
    lines.push('', `*${s.name}* (${s.total})`)
    for (const r of s.rows) {
      const meta = [r.singer, r.bpm && `${r.bpm} BPM`, r.key].filter(Boolean).join(' · ')
      lines.push(`${r.number}. ${r.title}${r.artist ? ` – ${r.artist}` : ''}${meta ? ` [${meta}]` : ''}`)
      if (r.url) lines.push(`   ${r.url}`)
    }
  }
  lines.push('', `Made with Setsmith for ${data.bandName}`)
  return lines.join('\n')
}

export function pdfFileName(data: ExportData): string {
  const slug = data.showName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `setlist-${slug || 'show'}.pdf`
}
