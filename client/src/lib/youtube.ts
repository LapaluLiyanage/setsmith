const ID = /^[A-Za-z0-9_-]{11}$/

/** Pull the 11-character video id out of any common YouTube URL form (or a bare id). */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim()
  if (ID.test(text)) return text
  let url: URL
  try {
    url = new URL(text.startsWith('http') ? text : `https://${text}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  let candidate: string | null = null
  if (host === 'youtu.be') candidate = url.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    candidate = url.searchParams.get('v')
    const parts = url.pathname.split('/').filter(Boolean)
    if (!candidate && ['shorts', 'embed', 'live', 'v'].includes(parts[0])) candidate = parts[1]
  }
  return candidate && ID.test(candidate) ? candidate : null
}

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`
export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
export const embedUrl = (id: string) => `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1`

/** ISO-8601 duration from the YouTube API ("PT4M13S") to seconds. */
export function parseIsoDuration(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!m) return 0
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}
