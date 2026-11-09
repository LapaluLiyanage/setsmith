# Setsmith 1.0.0

First public release. Setsmith is a setlist planner for live bands, built by Lapalu Liyanage and first used by
FASTUNES (Faculty of Applied Sciences, Rajarata University of Sri Lanka) for 3 shows.

## Highlights

- **Setlist editor**: shows with date, venue and booked slot; sessions with target times and live totals that warn
  when you run over.
- **Songs**: add from a YouTube link or search, assign a singer, transpose, add notes.
- **BPM and key**: GetSongBPM lookup, tap tempo, or manual entry; Camelot codes on every key; warnings for big key
  jumps and for a singer carrying more than 3 songs in a row.
- **Arranging**: drag and drop (mouse, touch, keyboard), quick swap, auto-arrange a session by BPM with an energy
  sparkline, undo (button or Ctrl+Z).
- **Stage view**: the gig screen with the current song in huge type, singer, key, BPM, private notes, a beat-pulse
  dot, the next song, and a progress strip. Swipe, tap, arrow keys or page-turner pedal; keeps the screen awake.
- **Chord sheets**: full-screen chords from Stage view, text or PDF, drawn page by page, with PDF export.
- **Song library**: search and filter by singer, language, BPM range and key; one tap adds a song to a show.
- **PDF export**: a table per session, YouTube links, a QR code per song, songs-per-singer summary; share to
  WhatsApp, email, or copy as text. Sinhala script prints in Noto Sans Sinhala.
- **Accounts and sharing** (Supabase): email/password or magic-link sign-in, live sync between devices, invite
  links for Editor or Viewer roles, and a public read-only link per show.
- **Everywhere**: installable PWA, light and dark theme, and iOS/Android apps through Capacitor.

## Known limitations

- Supabase is required; there is no offline-only mode.
- YouTube search and automatic BPM/key need your own `YOUTUBE_API_KEY` and `GETSONGBPM_API_KEY`. Pasted links and
  tap tempo work without them.
- BPM is never taken from downloaded YouTube audio, because YouTube's terms do not allow it.
- Many Sinhala tracks are missing from GetSongBPM, so tap tempo is the fallback.

## Upgrade and setup

See the "Run it" and "Deploy" sections of [README.md](README.md).

## Licence

Released under the [MIT License](LICENSE). Third-party components are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
