import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import sinhalaRegular from './fonts/NotoSansSinhala-Regular.ttf?url'
import sinhalaBold from './fonts/NotoSansSinhala-Bold.ttf?url'
import type { ExportData } from '../lib/exportData'

// The built-in PDF fonts have no Sinhala glyphs, so any text containing Sinhala switches to Noto Sans
// Sinhala. Self-hosted as TTF (not the @fontsource WOFF build): react-pdf's font embedding is built on
// pdfkit/fontkit, which handles TTF/OTF reliably but can throw "Offset is outside the bounds of the
// DataView" on some WOFF files at embed time.
Font.register({
  family: 'NotoSinhala',
  fonts: [{ src: sinhalaRegular, fontWeight: 400 }, { src: sinhalaBold, fontWeight: 700 }],
})
const SINHALA = /[඀-෿]/
const sf = (text: string | undefined, bold = false) =>
  text && SINHALA.test(text) ? { fontFamily: 'NotoSinhala', fontWeight: bold ? 700 : 400 } : {}

// Printed on paper and read on phones, so: white page, dark ink, one amber accent.
const INK = '#1d1f22'
const MUTED = '#6b6f75'
const LINE = '#dedad2'
const ACCENT = '#c77c0c'
const WARN = '#c2461f'

const s = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 44, paddingHorizontal: 32, fontFamily: 'Helvetica', fontSize: 9, color: INK },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 0.5 },
  band: { fontSize: 8, color: MUTED, letterSpacing: 1.5 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 20, marginBottom: 4 },
  meta: { fontSize: 10, color: MUTED, marginBottom: 12 },
  stats: { flexDirection: 'row', gap: 24, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE, marginBottom: 18 },
  statLabel: { fontSize: 7, color: MUTED, letterSpacing: 1 },
  statValue: { fontFamily: 'Courier-Bold', fontSize: 13 },
  sessionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, paddingBottom: 3, borderBottomWidth: 2, borderColor: ACCENT },
  sessionName: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  sessionTime: { fontFamily: 'Courier', fontSize: 9, color: MUTED },
  over: { color: WARN },
  header: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderColor: LINE },
  th: { fontFamily: 'Helvetica', fontSize: 7, color: MUTED, letterSpacing: 0.8 },
  row: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderColor: LINE, alignItems: 'center' },
  cNum: { width: 18, fontFamily: 'Courier', color: MUTED },
  cSong: { flex: 1, paddingRight: 6 },
  cSinger: { width: 64 },
  cBpm: { width: 32, fontFamily: 'Courier-Bold', textAlign: 'right', paddingRight: 8 },
  cKey: { width: 76 },
  cTime: { width: 32, fontFamily: 'Courier', textAlign: 'right', paddingRight: 8 },
  cLink: { width: 44, alignItems: 'center' },
  songTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: INK, textDecoration: 'none' },
  artist: { color: MUTED, fontSize: 8, marginTop: 1 },
  notes: { color: ACCENT, fontSize: 8, marginTop: 2 },
  camelot: { fontSize: 7, color: MUTED },
  qr: { width: 34, height: 34 },
  noLink: { fontSize: 7, color: MUTED },
  section: { marginBottom: 18 },
  summaryTitle: { fontFamily: 'Helvetica-Bold', fontSize: 13, marginBottom: 6 },
  summaryRow: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 1, borderColor: LINE, width: 240 },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: MUTED },
})

interface Props {
  data: ExportData
  /** YouTube URL → QR code PNG data URL. */
  qrCodes: Record<string, string>
}

export function SetlistPdf({ data, qrCodes }: Props) {
  return (
    <Document title={`${data.showName} – setlist`} author={data.bandName} creator="Setsmith">
      <Page size="A4" style={s.page}>
        <View style={s.brandRow} fixed>
          <Text style={s.brand}>SETSMITH</Text>
          <Text style={s.band}>{data.bandName.toUpperCase()}</Text>
        </View>

        <Text style={[s.title, sf(data.showName, true)]}>{data.showName}</Text>
        <Text style={[s.meta, sf(data.venue)]}>{[data.date, data.venue].filter(Boolean).join('  ·  ')}</Text>

        <View style={s.stats}>
          <Stat label="SONGS" value={String(data.songCount)} />
          <Stat label="PLANNED" value={data.planned} />
          <Stat label="BOOKED SLOT" value={data.slot} />
          <Stat label="SESSIONS" value={String(data.sessions.length)} />
        </View>

        {data.sessions.map((session, i) => (
          <View key={i} style={s.section}>
            <View style={s.sessionHead} wrap={false}>
              <Text style={[s.sessionName, sf(session.name, true)]}>{session.name}</Text>
              <Text style={[s.sessionTime, session.over ? s.over : {}]}>
                {session.total} of {session.target}{session.over ? '  (over)' : ''}
              </Text>
            </View>
            <View style={s.header} wrap={false}>
              <Text style={[s.cNum, s.th]}>#</Text>
              <Text style={[s.cSong, s.th]}>SONG</Text>
              <Text style={[s.cSinger, s.th]}>SINGER</Text>
              <Text style={[s.cBpm, s.th]}>BPM</Text>
              <Text style={[s.cKey, s.th]}>KEY</Text>
              <Text style={[s.cTime, s.th]}>TIME</Text>
              <Text style={[s.cLink, s.th, { textAlign: 'center' }]}>LISTEN</Text>
            </View>
            {session.rows.length === 0 && <Text style={[s.row, s.noLink]}>No songs in this session yet.</Text>}
            {session.rows.map((r) => (
              <View key={r.number} style={s.row} wrap={false}>
                <Text style={s.cNum}>{r.number}</Text>
                <View style={s.cSong}>
                  {r.url ? <Link src={r.url} style={[s.songTitle, sf(r.title, true)]}>{r.title}</Link> : <Text style={[s.songTitle, sf(r.title, true)]}>{r.title}</Text>}
                  {r.artist ? <Text style={[s.artist, sf(r.artist)]}>{r.artist}</Text> : null}
                  {r.notes ? <Text style={[s.notes, sf(r.notes)]}>{r.notes}</Text> : null}
                </View>
                <Text style={[s.cSinger, sf(r.singer)]}>{r.singer || '–'}</Text>
                <Text style={s.cBpm}>{r.bpm || '–'}</Text>
                <View style={s.cKey}>
                  <Text>{r.key || '–'}</Text>
                  {r.camelot ? <Text style={s.camelot}>{r.camelot}</Text> : null}
                </View>
                <Text style={s.cTime}>{r.duration || '–'}</Text>
                <View style={s.cLink}>
                  {r.url && qrCodes[r.url]
                    ? <Link src={r.url}><Image src={qrCodes[r.url]} style={s.qr} /></Link>
                    : <Text style={s.noLink}>no link</Text>}
                </View>
              </View>
            ))}
          </View>
        ))}

        {data.singerCounts.length > 0 && (
          <View wrap={false}>
            <Text style={s.summaryTitle}>Songs per singer</Text>
            {data.singerCounts.map((c) => (
              <View key={c.name} style={s.summaryRow}>
                <Text style={[{ flex: 1 }, sf(c.name)]}>{c.name}</Text>
                <Text style={{ fontFamily: 'Courier-Bold' }}>{c.count}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>Tap a song title or scan its code to hear it on YouTube.</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  )
}
