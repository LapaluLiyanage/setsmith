# Third-party notices

Setsmith is released under the MIT License (see [LICENSE](LICENSE)). It uses the following third-party material,
each under its own licence. This list is a summary; the authoritative terms ship with each package in
`node_modules/<package>/LICENSE` and at the links below.

## Bundled assets

| Component | Licence | Notes |
|---|---|---|
| Noto Sans Sinhala (Regular, Bold), Copyright 2022 The Noto Project Authors | SIL Open Font License 1.1 | Full text in `client/src/pdf/fonts/OFL.txt`. Used to print Sinhala script in PDFs. The font is not sold on its own. |

## Main dependencies

| Package | Licence |
|---|---|
| react, react-dom | MIT |
| @dnd-kit/core, sortable, utilities | MIT |
| @react-pdf/renderer | MIT |
| @supabase/supabase-js | MIT |
| three | MIT |
| qrcode | MIT |
| express | MIT |
| @capacitor/* (core, app, filesystem, haptics, share, splash-screen, status-bar, keep-awake) | MIT |
| pdfjs-dist | Apache-2.0 |
| gsap | GreenSock Standard "No Charge" License (https://gsap.com/standard-license) |

GSAP is not MIT. Its standard licence is free for this kind of use, but it forbids using GSAP in tools that
compete with Webflow. Read https://gsap.com/standard-license before redistributing Setsmith inside another product.

To regenerate the full list: `npx license-checker --production --summary`.

## External services and data

- **YouTube Data API v3**: use is subject to the YouTube API Services Terms of Service and Google's Privacy Policy.
  Setsmith never downloads YouTube audio.
- **GetSongBPM** (https://getsongbpm.com): BPM and key data. Its free API requires a visible backlink to
  getsongbpm.com, which the app provides. You need your own API key.
- **Supabase**: hosts accounts and band data under your own Supabase project and its terms.

## Trademarks

YouTube, Google, WhatsApp, Supabase, Capacitor, Apple, iOS and Android are trademarks of their respective owners.
Setsmith is not affiliated with or endorsed by any of them.
