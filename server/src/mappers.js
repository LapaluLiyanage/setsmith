// Pure functions that turn third-party API responses into Setsmith's shapes.
// Kept separate from the routes so they can be tested without network access.

export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** "PT4M13S" → 253 */
export function parseIsoDuration(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '')
  if (!m) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

/** Decode the handful of HTML entities YouTube leaves in snippet titles. */
export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

/** One item from YouTube `videos.list` (part=snippet,contentDetails). */
export function mapVideo(item) {
  return {
    youtubeId: item.id,
    title: decodeEntities(item.snippet?.title),
    channel: decodeEntities(item.snippet?.channelTitle),
    durationSec: parseIsoDuration(item.contentDetails?.duration),
  }
}

/** YouTube oEmbed response (no API key needed, but no duration). */
export function mapOembed(youtubeId, body) {
  return { youtubeId, title: body.title ?? '', channel: body.author_name ?? '', durationSec: null }
}

/**
 * GetSongBPM `/search` response. It returns `{ search: [...] }` on a hit and
 * `{ search: { error: "no result" } }` on a miss.
 */
export function mapBpmSearch(body) {
  if (!Array.isArray(body?.search)) return []
  return body.search.slice(0, 5).map((s) => ({
    title: s.title ?? s.song_title ?? '',
    artist: s.artist?.name ?? '',
    bpm: s.tempo ? Math.round(Number(s.tempo)) : null,
    key: s.key_of ?? null,
  }))
}
