import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { loadYouTubeApi, type YTPlayerInstance } from '../lib/ytPlayer'
import { thumbUrl } from '../lib/youtube'

interface Props {
  youtubeId: string
  title: string
  artist: string
}

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/** An mp3-player-style control bar: YouTube supplies the audio, but the video frame stays hidden off-screen. */
export function SongPlayer({ youtubeId, title, artist }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayerInstance | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    let cancelled = false
    let poll: ReturnType<typeof setInterval> | undefined
    setReady(false)
    setPlaying(false)
    setTime(0)
    setDuration(0)

    loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return
      new window.YT.Player(hostRef.current, {
        videoId: youtubeId,
        width: 200,
        height: 113,
        playerVars: { autoplay: 1, playsinline: 1, controls: 0, disablekb: 1, modestbranding: 1 },
        events: {
          onReady: (e) => {
            if (cancelled) return
            playerRef.current = e.target
            setReady(true)
            setDuration(e.target.getDuration())
            e.target.playVideo()
          },
          onStateChange: (e) => {
            const isPlaying = e.data === window.YT!.PlayerState.PLAYING
            setPlaying(isPlaying)
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
          },
        },
      })
      poll = setInterval(() => {
        if (playerRef.current) setTime(playerRef.current.getCurrentTime())
      }, 400)
    })

    return () => {
      cancelled = true
      clearInterval(poll)
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [youtubeId])

  // Tell the OS this is real media playback (title, artwork, lock-screen/notification controls) --
  // without this, mobile browsers are much quicker to pause a hidden video iframe once the app
  // is backgrounded or the screen locks, since it looks like inactive page content, not music.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title, artist, artwork: [{ src: thumbUrl(youtubeId), sizes: '320x180', type: 'image/jpeg' }],
    })
    navigator.mediaSession.setActionHandler('play', () => playerRef.current?.playVideo())
    navigator.mediaSession.setActionHandler('pause', () => playerRef.current?.pauseVideo())
    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
    }
  }, [youtubeId, title, artist])

  function toggle() {
    if (!playerRef.current) return
    if (playing) playerRef.current.pauseVideo()
    else playerRef.current.playVideo()
  }

  function onSeek(e: ChangeEvent<HTMLInputElement>) {
    const t = Number(e.target.value)
    setTime(t)
    playerRef.current?.seekTo(t, true)
  }

  return (
    <div className="mp3">
      <div ref={hostRef} className="mp3__hidden" aria-hidden />
      <img className="mp3__art" src={thumbUrl(youtubeId)} alt="" />
      <button type="button" className="mp3__play" onClick={toggle} disabled={!ready} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="mp3__body">
        <div className="mp3__head"><b className="mp3__title">{title}</b><span className="mp3__artist">{artist}</span></div>
        <input type="range" className="mp3__seek" min={0} max={duration || 0} step={1} value={Math.min(time, duration || 0)}
          onChange={onSeek} disabled={!ready} aria-label="Seek" />
        <span className="mp3__time mono">{fmt(time)} / {fmt(duration)}</span>
      </div>
    </div>
  )
}
