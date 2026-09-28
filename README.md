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
  Sinhala-script titles, artists and singer names print in Noto Sans Sinhala.
- **Accounts and sharing** (Supabase): email/password or magic-link sign-in, one band document synced live between
  devices, invite links that grant Editor or Viewer access, and a public read-only link per show.
  Without an account the app keeps working from browser storage.


## Run it

Requires Node 20+.

```bash
npm install
cp server/.env.example server/.env   # add your keys (optional)
npm run dev:server                   # API on http://localhost:4000
npm run dev:client                   # app on http://localhost:5173
```

### Supabase (accounts, sync, sharing)

1. Create a project and run `supabase/schema.sql` in the SQL editor.
2. `cp client/.env.example client/.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` (the publishable key).
   Leave them empty to run local-only.
3. Under Authentication → URL configuration add your site URL (and `http://localhost:5173` for development).
   Email sign-up needs confirmation by default; turn that off under Authentication → Providers → Email for a quick start.

The manager owns the band. Editors change the setlists, viewers see them. Saves are compared by revision, so if two
people save at once the second one reloads the first one's version instead of overwriting it.

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
  src/state/   reducer with undo, sample data, local save + Supabase sync (store.tsx)
  src/components/
server/    Express API that keeps keys off the browser and caches lookups
supabase/  schema.sql with row-level security per band
```

## Roadmap

1. ~~Setlist editor, drag and swap, BPM/key, tap tempo~~
2. ~~PDF export and send~~ (Sinhala font included)
3. ~~Supabase accounts, band invites with roles, read-only share link~~
4. ~~Song library view with filters~~ (search, singer, BPM range, Camelot key, language; add to any session)
5. Singer key ranges and transpose suggestions
6. ~~Stage view for phones~~ (big-type now/next, beat-pulse dot, swipe or arrow keys, keeps the screen on)
7. ~~Apply the Claude Design UI~~ (setlist editor, add-song, band and export panels; light/dark;
   GSAP card entrance, FLIP reorder, toasts; Three.js energy map)
