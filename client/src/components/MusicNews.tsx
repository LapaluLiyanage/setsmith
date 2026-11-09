import { useEffect, useState } from 'react'
import { fetchMusicNews, type NewsArticle } from '../lib/api'

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''

/** Latest music news from the Guardian (via /api/news). Renders nothing if the feed is unavailable. */
export default function MusicNews() {
  const [articles, setArticles] = useState<NewsArticle[] | null>(null)

  useEffect(() => {
    let live = true
    fetchMusicNews().then((a) => { if (live) setArticles(a) }).catch(() => { if (live) setArticles([]) })
    return () => { live = false }
  }, [])

  if (!articles || articles.length === 0) return null
  return (
    <section data-screen-label="Music news" style={{ background: 'var(--sf)', borderRadius: '32px', padding: 'clamp(28px,5vw,64px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ font: '500 11px var(--mono)', letterSpacing: '.12em', color: 'var(--mu)', flex: '1' }}>MUSIC NEWS</span>
        <span style={{ fontSize: '12px', color: 'var(--mu)' }}>via The Guardian</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '16px' }}>
        {articles.map((a) => (
          <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', flexDirection: 'column', gap: '10px', textDecoration: 'none', background: 'var(--p2)', border: '1px solid var(--ln)', borderRadius: '20px', overflow: 'hidden' }}>
            {a.image && <img src={a.image} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', display: 'block' }} />}
            <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ font: '500 11px var(--mono)', color: 'var(--mu)' }}>{when(a.publishedAt)}</span>
              <b style={{ fontWeight: 600, fontSize: '16px', lineHeight: 1.3 }}>{a.title}</b>
              <span style={{ color: 'var(--mu)', fontSize: '13px', lineHeight: 1.45 }}>{a.summary}</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
