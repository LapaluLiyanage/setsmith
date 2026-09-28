import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { YOUTUBE_ID, mapBpmSearch, mapOembed, mapVideo } from './mappers.js'

const PORT = Number(process.env.PORT ?? 4000)
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const GETSONGBPM_API_KEY = process.env.GETSONGBPM_API_KEY
const GETSONGBPM_BASE_URL = process.env.GETSONGBPM_BASE_URL ?? 'https://api.getsong.co'

const app = express()

// Lookups barely change, so a small in-memory cache saves YouTube quota (search costs 100 units).
const cache = new Map()
const CACHE_MS = 6 * 60 * 60 * 1000
async function cachedJson(url) {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body
  const res = await fetch(url)
  if (!res.ok) {
    const err = new Error(`Upstream returned ${res.status}`)
    err.status = res.status === 404 ? 404 : 502
    throw err
  }
  const body = await res.json()
  cache.set(url, { at: Date.now(), body })
  return body
}

const wrap = (handler) => (req, res) =>
  handler(req, res).catch((err) => {
    console.error(err)
    res.status(err.status ?? 500).json({ error: err.publicMessage ?? 'Lookup failed' })
  })

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, youtubeSearch: Boolean(YOUTUBE_API_KEY), bpmLookup: Boolean(GETSONGBPM_API_KEY) })
})

app.get('/api/youtube/video/:id', wrap(async (req, res) => {
  const { id } = req.params
  if (!YOUTUBE_ID.test(id)) return res.status(400).json({ error: 'That is not a YouTube video id' })

  if (YOUTUBE_API_KEY) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${id}&key=${YOUTUBE_API_KEY}`
    const body = await cachedJson(url)
    const item = body.items?.[0]
    if (!item) return res.status(404).json({ error: 'Video not found or private' })
    return res.json(mapVideo(item))
  }

  // No key: oEmbed still gives the title and channel.
  const oembed = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`
  res.json(mapOembed(id, await cachedJson(oembed)))
}))

app.get('/api/youtube/search', wrap(async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  if (!q) return res.status(400).json({ error: 'Type something to search for' })
  if (!YOUTUBE_API_KEY) {
    return res.status(503).json({ error: 'YouTube search is not set up yet (missing YOUTUBE_API_KEY). Paste a link instead' })
  }

  const search = await cachedJson(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=8&q=${encodeURIComponent(q)}&key=${YOUTUBE_API_KEY}`,
  )
  const ids = (search.items ?? []).map((i) => i.id?.videoId).filter(Boolean)
  if (ids.length === 0) return res.json({ results: [] })
  // A second, cheap call (1 unit) fills in durations, which search results don't include.
  const details = await cachedJson(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`,
  )
  res.json({ results: (details.items ?? []).map(mapVideo) })
}))

app.get('/api/bpm', wrap(async (req, res) => {
  const title = String(req.query.title ?? '').trim()
  const artist = String(req.query.artist ?? '').trim()
  if (!title) return res.status(400).json({ error: 'Song title is required' })
  if (!GETSONGBPM_API_KEY) {
    return res.status(503).json({ error: 'BPM lookup is not set up yet (missing GETSONGBPM_API_KEY)' })
  }

  const lookup = artist ? `song:${title} artist:${artist}` : title
  const type = artist ? 'both' : 'song'
  const body = await cachedJson(
    `${GETSONGBPM_BASE_URL}/search/?api_key=${GETSONGBPM_API_KEY}&type=${type}&lookup=${encodeURIComponent(lookup)}`,
  )
  res.json({ matches: mapBpmSearch(body) })
}))

// In production the API also serves the built client, so one service hosts everything.
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url))
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(`${dist}/index.html`))
}

app.listen(PORT, () => {
  console.log(`Setsmith API on http://localhost:${PORT}`)
  if (!YOUTUBE_API_KEY) console.log('  YOUTUBE_API_KEY not set: search off, pasted links use oEmbed')
  if (!GETSONGBPM_API_KEY) console.log('  GETSONGBPM_API_KEY not set: BPM lookup off, tap tempo still works')
})
