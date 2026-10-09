// Thin wrappers over the Setsmith server (see /server). The server holds the API keys.

export interface VideoInfo {
  youtubeId: string
  title: string
  channel: string
  durationSec: number | null
}

export interface BpmMatch {
  title: string
  artist: string
  bpm: number | null
  key: string | null
}

// Web: same-origin. Native app: set VITE_API_URL (e.g. https://setsmith.onrender.com) so calls reach the server.
const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as T
}

export const fetchVideo = (youtubeId: string) =>
  getJson<VideoInfo>(`/api/youtube/video/${encodeURIComponent(youtubeId)}`)

export const searchYouTube = (q: string) =>
  getJson<{ results: VideoInfo[] }>(`/api/youtube/search?q=${encodeURIComponent(q)}`).then((r) => r.results)

export const lookupBpm = (title: string, artist: string) =>
  getJson<{ matches: BpmMatch[] }>(
    `/api/bpm?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
  ).then((r) => r.matches)
