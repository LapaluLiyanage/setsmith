import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { isChordLine } from '../lib/chordSheet'
import type { StageSong } from '../lib/stage'
import { sf } from './SetlistPdf'

const INK = '#1d1f22'
const MUTED = '#6b6f75'
const ACCENT = '#c77c0c'

const PAGE_W = 595 - 64 // A4 minus the horizontal padding
const s = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 44, paddingHorizontal: 32, fontFamily: 'Helvetica', fontSize: 9, color: INK },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 0.5 },
  band: { fontSize: 8, color: MUTED, letterSpacing: 1.5 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 18, marginBottom: 3 },
  meta: { fontSize: 9, color: MUTED, paddingBottom: 8, marginBottom: 10, borderBottomWidth: 2, borderColor: ACCENT },
  chord: { fontFamily: 'Courier-Bold', color: ACCENT },
  lyric: { fontFamily: 'Courier' },
  section: { fontFamily: 'Courier', color: MUTED },
  image: { width: '100%', objectFit: 'contain' },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: MUTED },
})

// The built-in PDF fonts have no sharp/flat glyphs; transposed sheets use them.
const ascii = (t: string) => t.replace(/♯/g, '#').replace(/♭/g, 'b')

function Sheet({ song, bandName }: { song: StageSong; bandName: string }) {
  const lines = (song.chordSheet ?? '').split('\n').map(ascii)
  // Courier is 0.6em wide: shrink so the longest line fits the page instead of wrapping and breaking alignment.
  const longest = Math.max(1, ...lines.map((l) => l.length))
  const size = Math.max(6, Math.min(10, PAGE_W / (longest * 0.6)))
  const meta = [song.artist, song.key?.replace(' major', '').replace(' minor', 'm'), song.bpm && `${song.bpm} BPM`, song.singer.name, song.transposeNote]
    .filter(Boolean).join('  ·  ')
  return (
    <Page size="A4" style={s.page} wrap>
      <View style={s.brandRow} fixed>
        <Text style={s.brand}>Setsmith</Text>
        <Text style={s.band}>{bandName.toUpperCase()}</Text>
      </View>
      <Text style={[s.title, sf(song.stageTitle, true)]}>{song.number}. {ascii(song.stageTitle)}</Text>
      <Text style={[s.meta, sf(meta)]}>{ascii(meta)}</Text>
      {song.chordSheet ? lines.map((line, i) => (
        <Text key={i} wrap={false}
          style={[isChordLine(line) ? s.chord : /^\s*\[.*\]\s*$/.test(line) ? s.section : s.lyric, { fontSize: size, lineHeight: 1.45 }, sf(line)]}>
          {line || ' '}
        </Text>
      )) : song.chordSheetImage ? <Image src={song.chordSheetImage} style={s.image} /> : null}
      <View style={s.footer} fixed>
        <Text>Made with Setsmith for {bandName}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  )
}

/** One song per page (more if the sheet is long), in setlist order, using each song's transposed chord sheet. */
export function ChordSheetsPdf({ songs, bandName, showName }: { songs: StageSong[]; bandName: string; showName: string }) {
  return (
    <Document title={`${showName} – chord sheets`} author="Setsmith">
      {songs.map((song) => <Sheet key={song.itemId} song={song} bandName={bandName} />)}
    </Document>
  )
}
