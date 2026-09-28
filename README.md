# Setsmith

Setlist planner for live bands, built by **FASTUNES**.

Book a show → split it into sessions → add songs from YouTube → assign singers → see each song's
BPM and key → rearrange with drag-and-drop or quick swap → send the band a PDF with the YouTube links.

## What works now

- Shows with date, venue and booked slot; sessions with target times and live totals (warns when over)
- Add songs by pasting a YouTube link (title comes from YouTube) or searching (needs an API key)
- Singer per song, transpose, notes
- BPM and key per song: lookup through GetSongBPM (needs a key), **tap tempo**, or manual entry
- Camelot codes on every key, warning when the key jump between two songs is too big,
  warning when one singer has more than 3 in a row
- Drag and drop within and between sessions (mouse, touch and keyboard)
- Quick swap: press ⇄ on one song, then ⇄ on another
- Auto-arrange a session by BPM (build up, cool down, peak in the middle) with an energy sparkline
- Undo (button or Ctrl+Z)
- **Stage view** for the gig: current song in huge type with singer, key, BPM and notes, a dot pulsing on the beat,
  next song below; swipe, tap or use arrow keys / a page-turner pedal; keeps the phone screen awake
- Band members with roles (manager / editor / viewer)
- **PDF export**: a table per session (singer, BPM, key with Camelot code, transpose, notes, time),
  song titles link to YouTube, a QR code per song for printed copies, songs-per-singer summary.
  Download, share straight to WhatsApp on phones, open an email, or copy a text version.
  Known gap: song titles typed in Sinhala script won't print yet (the PDF uses built-in Latin fonts).

Data is saved in the browser for now. Supabase (accounts, sharing, sync across the band) is the next milestone.

## Run it

Requires Node 20+.

```bash
npm install
cp server/.env.example server/.env   # add your keys (optional)
npm run dev:server                   # API on http://localhost:4000
npm run dev:client                   # app on http://localhost:5173
```

`npm test` runs the client (Vitest) and server (node:test) tests.

### API keys (all optional)

| Key | Gives you | Where |
|---|---|---|
| `YOUTUBE_API_KEY` | YouTube search and video length | Google Cloud console → YouTube Data API v3 |
| `GETSONGBPM_API_KEY` | Automatic BPM and key | getsongbpm.com/api (free, needs a backlink) |

Without keys, pasted YouTube links still work and tempo can be tapped in.
BPM is never taken by downloading YouTube audio, which YouTube's terms don't allow.

## Layout

```
client/    React + Vite + TypeScript, dnd-kit, GSAP, Three.js (energy map, lazy-loaded)
  src/lib/     pure logic (setlist moves, Camelot keys, tap tempo, YouTube URLs) + tests
  src/state/   reducer with undo, sample data, local save
  src/components/
server/    Express API that keeps keys off the browser and caches lookups
supabase/  schema.sql with row-level security per band
```

## Roadmap

1. ~~Setlist editor, drag and swap, BPM/key, tap tempo~~
2. ~~PDF export and send~~ (next: Sinhala-script font in the PDF)
3. Supabase accounts, band invites with roles, read-only share link
4. ~~Song library view with filters~~ (search, singer, BPM range, Camelot key, language; add to any session)
5. Singer key ranges and transpose suggestions
6. ~~Stage view for phones~~ (big-type now/next, beat-pulse dot, swipe or arrow keys, keeps the screen on)
7. ~~Apply the Claude Design UI~~ (setlist editor, add-song, band and export panels; light/dark;
   GSAP card entrance, FLIP reorder, toasts; Three.js energy map)
