import { gsap } from 'gsap'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { reducedMotion } from '../lib/motion'
import { isChordLine, transposeChord, transposeChordSheet } from '../lib/chordSheet'
import { beatSeconds, buildStageList } from '../lib/stage'
import type { Show } from '../lib/types'
import { watchUrl } from '../lib/youtube'
import { loadYouTubeApi } from '../lib/ytPlayer'
import { useStore } from '../state/store'
import { SongPlayer } from './SongPlayer'

const SWIPE_PX = 50

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Keep the phone screen on while the band is playing. Not every browser allows it; that's fine. */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
        lock = (await nav.wakeLock?.request('screen')) ?? null
      } catch {
        lock = null
      }
    }
    request()
    const onVisible = () => document.visibilityState === 'visible' && request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])
}

type FSDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> }
type FSElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }

/** True fullscreen (hides the browser chrome/address bar too), for reading a chart or the
 * key/BPM cards from across the stage. iOS Safari on iPhone has no Fullscreen API at all --
 * there's no fallback for that, so the button just doesn't appear there. */
function useFullscreen(ref: { current: HTMLElement | null }) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const onChange = () => setActive(!!(document.fullscreenElement || (document as FSDocument).webkitFullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])
  const supported = typeof document !== 'undefined' && (document.fullscreenEnabled || !!(document as FSDocument).webkitExitFullscreen)
  function toggle() {
    if (active) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
      else (document as FSDocument).webkitExitFullscreen?.()
    } else {
      const el = ref.current as FSElement | null
      if (!el) return
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
      else el.webkitRequestFullscreen?.()
    }
  }
  return { active, supported, toggle }
}

export function StageView({ show, onClose }: { show: Show; onClose: () => void }) {
  const { state, cloud } = useStore()
  const list = useMemo(() => buildStageList(show, state.songs, state.members), [show, state.songs, state.members])
  const [index, setIndex] = useState(0)
  const [showChords, setShowChords] = useState(false)
  const [chordTranspose, setChordTranspose] = useState(0)
  const [capo, setCapo] = useState(0)
  const [twoCol, setTwoCol] = useState(() => {
    try { return localStorage.getItem('stageChordCols') === '2' } catch { return false }
  })
  const toggleTwoCol = () => setTwoCol((v) => {
    try { localStorage.setItem('stageChordCols', v ? '1' : '2') } catch { /* private mode */ }
    return !v
  })
  const [fontSize, setFontSize] = useState(() => {
    try { return Number(localStorage.getItem('stageChordFont')) || 16 } catch { return 16 }
  })
  const changeFont = (d: number) => setFontSize((f) => {
    const n = Math.max(10, Math.min(40, f + d))
    try { localStorage.setItem('stageChordFont', String(n)) } catch { /* private mode */ }
    return n
  })
  const chordsRef = useRef<HTMLDivElement>(null)
  const [fullSheet, setFullSheet] = useState(false)
  const [barShown, setBarShown] = useState(true)
  const barTimer = useRef<number>(0)
  const [scrolling, setScrolling] = useState(false)
  const [speed, setSpeed] = useState(4)
  const [imgZoom, setImgZoom] = useState(1)
  const [showVideo, setShowVideo] = useState<0 | 1 | 2>(0)
  const [noteDraft, setNoteDraft] = useState('')
  const direction = useRef(1)
  const x0 = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const currentRef = useRef<HTMLDivElement>(null)
  const beatRef = useRef<HTMLDivElement>(null)
  const clock = useClock()
  useWakeLock()
  const { active: fsActive, supported: fsSupported, toggle: toggleFullscreen } = useFullscreen(rootRef)

  // Fetch the YouTube player script as soon as Stage view opens, not on the first tap of Play --
  // by then it's already loaded, so playVideo() still runs within the tap's gesture and isn't
  // blocked by mobile autoplay policies the way a fresh, mid-tap script load would be.
  useEffect(() => { loadYouTubeApi() }, [])

  // Synced shows: everyone follows the shared pointer; only managers/editors can move it.
  const synced = cloud.configured && !!cloud.band
  const canControl = !cloud.readOnly

  const cur = list[Math.min(index, list.length - 1)]
  const chordLines = useMemo(() => {
    if (!cur?.chordSheet) return []
    const shift = chordTranspose - capo
    return (shift ? transposeChordSheet(cur.chordSheet, shift) : cur.chordSheet).split('\n')
  }, [cur?.chordSheet, chordTranspose, capo])
  const next = list[index + 1]
  const liveIndex = synced && cloud.nowPlaying?.showId === show.id
    ? list.findIndex((s) => s.itemId === cloud.nowPlaying!.itemId) : -1
  const offLive = !canControl && liveIndex >= 0 && liveIndex !== index

  // Whenever the coordinator actually moves to a song, jump there — even if a follower had
  // browsed off to look ahead. Controllers get pulled to it too (e.g. another editor moved it),
  // but their own moves land here first anyway, so this never fights their own navigation.
  useEffect(() => {
    if (liveIndex < 0 || liveIndex === index) return
    direction.current = liveIndex > index ? 1 : -1
    setIndex(liveIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud.nowPlaying, synced, show.id])

  function go(step: number) {
    const i = Math.max(0, Math.min(list.length - 1, index + step))
    if (i === index) return
    direction.current = step
    setIndex(i)
    if (synced && canControl && list[i]) cloud.setNowPlaying(show.id, list[i].itemId)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Typing in the note box (or any field) must not trigger navigation shortcuts.
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(TEXTAREA|INPUT|SELECT)$/.test(t.tagName))) {
        if (e.key === 'Escape') t.blur()
        return
      }
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Screen fades up when opened.
  useLayoutEffect(() => {
    if (reducedMotion() || !rootRef.current) return
    const ctx = gsap.context(() => gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }))
    return () => ctx.revert()
  }, [])

  // Stop any playing video, and reset the local chord transpose, when the song changes.
  useEffect(() => { setShowVideo(0); setChordTranspose(0); setCapo(0); setImgZoom(1); setScrolling(false) }, [index])

  // Auto-scroll the chord sheet at `speed` (1 = slow crawl). Fractional pixels are accumulated
  // because scrollTop rounds; stops by itself at the bottom.
  useEffect(() => {
    const el = chordsRef.current ?? rootRef.current
    if (!scrolling || !el) return
    let raf = 0, last = performance.now(), pos = el.scrollTop
    const tick = (t: number) => {
      pos += ((t - last) / 1000) * speed * 8
      last = t
      el.scrollTop = pos
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { setScrolling(false); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [scrolling, speed, showChords, index])

  const shift = chordTranspose - capo
  const keyLabel = cur?.key ? cur.key.replace(' major', '').replace(' minor', 'm') : null
  const shownKey = keyLabel ? (shift ? transposeChord(keyLabel, shift) : keyLabel) : null
  const edited = chordTranspose !== 0 || capo !== 0 || fontSize !== 16

  // Your own private note for this song -- nobody else can see it, and it's stored separately
  // from the shared setlist, so it never syncs to anyone else's screen.
  const myNote = (cur && cloud.myNotes[cur.itemId]) ?? ''
  useEffect(() => { setNoteDraft(myNote) }, [cur?.itemId]) // eslint-disable-line react-hooks/exhaustive-deps

  function saveNote() {
    if (cur && noteDraft !== myNote) cloud.setMyNote(cur.itemId, noteDraft)
  }

  // New song slides in from the side you swiped towards.
  useLayoutEffect(() => {
    if (reducedMotion() || !currentRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(currentRef.current, { x: direction.current * 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' })
    })
    return () => ctx.revert()
  }, [index])

  // The dot pulses on the beat of the current song.
  useLayoutEffect(() => {
    if (!beatRef.current || reducedMotion()) return
    const per = beatSeconds(cur?.bpm ?? null)
    const tween = gsap.fromTo(beatRef.current, { scale: 1.25, opacity: 1 },
      { scale: 0.7, opacity: 0.45, duration: per * 0.9, ease: 'power2.out', repeat: -1, repeatDelay: per * 0.1 })
    return () => { tween.kill() }
  }, [cur?.bpm, index])

  // Buttons, links and the chord/player areas handle their own taps and drags; a stray
  // pointerup landing back on the root (common on mobile touch) must not read as a swipe.
  function isSwipeable(target: EventTarget | null): boolean {
    return !(target instanceof Element && target.closest('button, a, input, select, textarea, .stage__chords, .stage__chordbar, .stage__chordimgwrap, .stage__sheet, .mp3'))
  }
  function onPointerDown(e: PointerEvent) { x0.current = isSwipeable(e.target) ? e.clientX : null }
  function onPointerUp(e: PointerEvent) {
    if (x0.current == null) return
    const dx = e.clientX - x0.current
    x0.current = null
    if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1)
  }

  // Chord focus (opened with the Full screen button in the chord toolbar): the sheet takes the whole screen and its toolbar fades away after a few seconds;
  // tapping the sheet (or the corner handle) brings it back. A photo sheet keeps the normal layout.
  const focusSheet = showChords && fullSheet && !!cur?.chordSheet && !cur.chordSheetImage
  useEffect(() => { if (!showChords) setFullSheet(false) }, [showChords])
  function wakeBar() {
    setBarShown(true)
    window.clearTimeout(barTimer.current)
    barTimer.current = window.setTimeout(() => setBarShown(false), 4000)
  }
  function toggleBar() {
    if (barShown) { window.clearTimeout(barTimer.current); setBarShown(false) } else wakeBar()
  }
  useEffect(() => {
    if (!focusSheet) return
    wakeBar()
    return () => window.clearTimeout(barTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSheet, index])

  // Group each chord line with the lyric under it, and turn blank lines into spacing before the next
  // group: a group never splits across columns, and spacing at the top of a column is dropped, so
  // both columns start flush at the top instead of with a blank gap.
  const chordBody = useMemo(() => {
    const kind = (l: string) => (isChordLine(l) ? 'stage__cl stage__cl--chord'
      : /^s*[.*]s*$/.test(l) ? 'stage__cl stage__cl--section' : 'stage__cl')
    const units: { key: number; gap: number; rows: { text: string; cls: string }[] }[] = []
    let gap = 0
    for (let i = 0; i < chordLines.length; i++) {
      const line = chordLines[i]
      if (!line.trim()) { gap++; continue }
      const rows = [{ text: line, cls: kind(line) }]
      const nextLine = chordLines[i + 1]
      if (isChordLine(line) && nextLine !== undefined && nextLine.trim() && !isChordLine(nextLine) && !/^s*[.*]s*$/.test(nextLine)) {
        rows.push({ text: nextLine, cls: kind(nextLine) })
        i++
      }
      units.push({ key: i, gap: units.length ? gap : 0, rows })
      gap = 0
    }
    return units.map((u) => (
      <div key={u.key} className="stage__unit" style={u.gap ? { marginTop: `${u.gap * 1.6}em` } : undefined}>
        {u.rows.map((r, j) => <div key={j} className={r.cls}>{r.text}</div>)}
      </div>
    ))
  }, [chordLines])

  const chordTools = (
    <>
                    <div className="stage__group">
                    <span className="stage__label">TRANSPOSE</span>
                    <div className="stepper">
                      <button type="button" aria-label="Transpose chords down" onClick={() => setChordTranspose((t) => Math.max(-11, t - 1))}>−</button>
                      <span>{chordTranspose > 0 ? `+${chordTranspose}` : chordTranspose}</span>
                      <button type="button" aria-label="Transpose chords up" onClick={() => setChordTranspose((t) => Math.min(11, t + 1))}>+</button>
                    </div>
                    {shownKey && <b className="stage__keynow">{shownKey}</b>}
                    {chordTranspose !== 0 && <button type="button" className="stage__tool" onClick={() => setChordTranspose(0)}>Reset</button>}
                    </div>
                    <div className="stage__group">
                    <span className="stage__label">CAPO</span>
                    <div className="stepper">
                      <button type="button" aria-label="Capo down" onClick={() => setCapo((c) => Math.max(0, c - 1))}>−</button>
                      <span>{capo || '–'}</span>
                      <button type="button" aria-label="Capo up" onClick={() => setCapo((c) => Math.min(11, c + 1))}>+</button>
                    </div>
                    </div>
                    <div className="stage__group">
                    <button type="button" className="stage__tool" aria-label="Smaller text" onClick={() => changeFont(-2)}>A−</button>
                    <button type="button" className="stage__tool" aria-label="Larger text" onClick={() => changeFont(2)}>A+</button>
                    <button type="button" className="stage__tool" aria-label="Reset transpose, capo and text size" disabled={!edited}
                      onClick={() => { setChordTranspose(0); setCapo(0); setFontSize(16); try { localStorage.removeItem('stageChordFont') } catch { /* private mode */ } }}>↺</button>
                    <button type="button" className="stage__tool" aria-pressed={twoCol} onClick={toggleTwoCol}>
                      {twoCol ? '1 column' : '2 columns'}
                    </button>
                    {!focusSheet && <button type="button" className="stage__tool stage__tool--go" onClick={() => setFullSheet(true)}>⤢ Full screen</button>}
                    </div>
                    <div className="stage__group">
                    <button type="button" className="stage__tool stage__tool--go" aria-pressed={scrolling}
                      onClick={() => setScrolling((v) => !v)}>{scrolling ? '■ Stop' : '▶ Auto-scroll'}</button>
                    <div className="stepper">
                      <button type="button" aria-label="Slower scroll" onClick={() => setSpeed((s) => Math.max(1, s - 1))}>−</button>
                      <span>{speed}</span>
                      <button type="button" aria-label="Faster scroll" onClick={() => setSpeed((s) => Math.min(10, s + 1))}>+</button>
                    </div>
                    </div>
    </>
  )

  return (
    <div ref={rootRef} className="stage" role="dialog" aria-modal="true" aria-label="Stage view"
      onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <div className="stage__col">
        <header className="stage__head">
          <button className="stage__close" onClick={onClose} aria-label="Close stage view">×</button>
          {fsSupported && (
            <button className="stage__close" onClick={toggleFullscreen} aria-label={fsActive ? 'Exit full screen' : 'Full screen'}>
              {fsActive ? '⤢' : '⛶'}
            </button>
          )}
          <div className="stage__where">
            <span>{cur ? `${cur.sessionName.toUpperCase()} SESSION` : show.name}</span>
            <b>{cur ? `Song ${cur.inSession} of ${cur.sessionSize} · ${cur.number}/${list.length} tonight` : 'No songs yet'}</b>
          </div>
          {synced && (
            <span className="stage__sync" title={canControl ? 'You control what everyone sees' : "Following the coordinator's phone"}>
              {canControl ? '● LIVE' : offLive ? '◐ BROWSING' : '◐ FOLLOWING'}
            </span>
          )}
          <span className="stage__clock">{clock}</span>
        </header>

        <div className="stage__bars" aria-hidden>
          {list.map((s, j) => <i key={s.itemId} className={j < index ? 'done' : j === index ? 'now' : ''} />)}
        </div>

        {cur ? (
          <div ref={currentRef} className="stage__now" aria-live="polite">
            <div className="stage__beat"><span className="stage__dot-wrap"><i ref={beatRef} /></span>NOW · {String(cur.number).padStart(2, '0')}</div>
            <div className="stage__titlerow">
              <h1>{cur.stageTitle}</h1>
              <div className="stage__titleactions">
                {cur.youtubeId && (
                  <button type="button" className="stage__playbtn" aria-pressed={showVideo !== 0}
                    aria-label={showVideo !== 0 ? 'Stop playback' : 'Play'}
                    onClick={() => setShowVideo((v) => (v !== 0 ? 0 : 1))}>
                    {showVideo !== 0 ? '■' : '▶'}
                  </button>
                )}
                {(cur.chordSheet || cur.chordSheetImage) && (
                  <button type="button" className="stage__chordtoggle"
                    onClick={() => setShowChords((v) => !v)} aria-pressed={showChords}>
                    {showChords ? 'Hide chords' : 'Chords'}
                  </button>
                )}
              </div>
            </div>
            <span className="stage__artist">{[cur.artist, cur.transposeNote].filter(Boolean).join(' · ')}</span>
            {showChords && !focusSheet && (cur.chordSheet || cur.chordSheetImage) ? (
              <>
                {cur.chordSheet && (
                  <div className="stage__chordbar">
                    {chordTools}
                  </div>
                )}
                {cur.chordSheetImage && (
                  <div className="stage__chordbar">
                    <span className="stage__label">ZOOM</span>
                    <div className="stepper">
                      <button type="button" aria-label="Zoom out" onClick={() => setImgZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}>−</button>
                      <span>{Math.round(imgZoom * 100)}%</span>
                      <button type="button" aria-label="Zoom in" onClick={() => setImgZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}>+</button>
                    </div>
                    {imgZoom !== 1 && <button type="button" className="stage__yt" onClick={() => setImgZoom(1)}>Reset</button>}
                  </div>
                )}
                {cur.chordSheetImage && (
                  <div className="stage__chordimgwrap">
                    <img className="stage__chordimg" src={cur.chordSheetImage} alt="Chord sheet"
                      style={imgZoom > 1 ? { width: `${imgZoom * 100}%`, maxWidth: 'none' } : undefined} />
                  </div>
                )}
                {cur.chordSheet && (
                  <div className={`stage__chords${twoCol ? ' stage__chords--two' : ''}`}
                    style={{ '--maxch': Math.max(1, ...chordLines.map((l) => l.length)), fontSize } as CSSProperties}>
                    {chordBody}
                  </div>
                )}
              </>
            ) : (
              <div className="stage__grid">
                <div className="stage__card stage__card--wide">
                  <span className="stage__avatar" style={{ background: cur.singer.color }}>{cur.singer.initial}</span>
                  <div><span className="stage__label">{cur.singer2 ? 'SINGER 1' : cur.coSingers.length ? 'SINGERS' : 'SINGER'}</span>
                    <b className="stage__big">{[cur.singer.name, ...cur.coSingers.map((s) => s.name)].join(' & ')}</b></div>
                  {cur.singer2 && (
                    <>
                      <span className="stage__avatar" style={{ background: cur.singer2.color }}>{cur.singer2.initial}</span>
                      <div><span className="stage__label">SINGER 2</span><b className="stage__big">{cur.singer2.name}</b></div>
                    </>
                  )}
                </div>
                <div className="stage__card">
                  <span className="stage__label">KEY</span>
                  <b className="stage__big">{cur.key ? cur.key.replace(' major', '').replace(' minor', 'm') : '—'}</b>
                  <span className="stage__accent">{cur.camelot ? `Camelot ${cur.camelot}` : 'key not set'}</span>
                </div>
                <div className="stage__card stage__card--bpm">
                  <span className="stage__label">BPM</span>
                  <b className="stage__bpm">{cur.bpm ?? '—'}</b>
                  <span>{cur.duration}</span>
                </div>
                <div className="stage__card stage__card--wide stage__notes">
                  <span className="stage__label">YOUR NOTE · ONLY YOU SEE THIS</span>
                  <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={saveNote}
                    placeholder="A private cue or reminder — nobody else on the band sees this…" rows={2} />
                  {noteDraft !== myNote && <button type="button" className="stage__notesave" onClick={saveNote}>Save note</button>}
                </div>
              </div>
            )}
            {cur.youtubeId && showVideo !== 0 && (
              <div>
                <SongPlayer youtubeId={showVideo === 2 && cur.youtubeId2 ? cur.youtubeId2 : cur.youtubeId} title={cur.title} artist={cur.artist} />
                <div className="stage__ytrow" style={{ marginTop: 8 }}>
                  {cur.youtubeId2 && (
                    <>
                      <button type="button" className={'stage__yt' + (showVideo !== 2 ? ' stage__yt--play' : '')}
                        onClick={() => setShowVideo(1)}>Song 1</button>
                      <button type="button" className={'stage__yt' + (showVideo === 2 ? ' stage__yt--play' : '')}
                        onClick={() => setShowVideo(2)}>Song 2</button>
                    </>
                  )}
                  <a className="stage__yt" href={watchUrl(cur.youtubeId)} target="_blank" rel="noreferrer">Open in YouTube</a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="stage__now"><h1>Add songs to the setlist first.</h1></div>
        )}

        <footer className="stage__foot">
          {offLive && (
            <button className="stage__backlive"
              onClick={() => { direction.current = liveIndex > index ? 1 : -1; setIndex(liveIndex) }}>
              ↻ Back to live · {list[liveIndex]?.stageTitle}
            </button>
          )}
          {next ? (
            <button className="stage__next" onClick={() => go(1)}>
              <div>
                <span className="stage__label">NEXT · {String(next.number).padStart(2, '0')}{next.sessionName !== cur?.sessionName ? ` · ${next.sessionName.toUpperCase()}` : ''}</span>
                <b>{next.stageTitle}</b>
                <span className="stage__meta">{[next.singer.name, next.key?.replace(' major', '').replace(' minor', 'm'), next.bpm && `${next.bpm} bpm`].filter(Boolean).join(' · ')}</span>
              </div>
              <i>→</i>
            </button>
          ) : cur ? (
            <div className="stage__last">Last song of the night — thank you{show.venue ? `, ${show.venue}` : ''}.</div>
          ) : null}
          <div className="stage__nav">
            <button onClick={() => go(-1)} disabled={index === 0}>← PREV</button>
            <span>{synced && !canControl ? 'SWIPE TO BROWSE · SYNCS WHEN THE SONG CHANGES' : 'SWIPE LEFT TO ADVANCE'}</span>
          </div>
        </footer>
      </div>

      {focusSheet && cur && (
        <div className="stage__sheet">
          <div className={'stage__sheetbar' + (barShown ? '' : ' stage__sheetbar--hidden')} onPointerDownCapture={wakeBar}>
            <div className="stage__sheethead">
              <button type="button" className="stage__tool" aria-label="Previous song" disabled={index === 0} onClick={() => go(-1)}>‹</button>
              <b className="stage__sheettitle">{cur.stageTitle}</b>
              <button type="button" className="stage__tool" aria-label="Next song" disabled={!next} onClick={() => go(1)}>›</button>
              {fsSupported && (
                <button type="button" className="stage__tool" aria-label={fsActive ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
                  {fsActive ? '⤢' : '⛶'}
                </button>
              )}
              <button type="button" className="stage__tool stage__tool--go" onClick={() => setFullSheet(false)}>⤡ Exit full screen</button>
            </div>
            <div className="stage__chordbar">{chordTools}</div>
          </div>
          {!barShown && (
            <div className="stage__sheetpeek">
              <button type="button" aria-label="Exit full screen" onClick={() => setFullSheet(false)}>⤡</button>
              <button type="button" aria-label="Show controls" onClick={wakeBar}>☰</button>
            </div>
          )}
          <div key={cur.itemId} ref={chordsRef} className="stage__chords stage__chords--focus" style={{ fontSize }} onClick={toggleBar}>
            <div className={'stage__cols' + (twoCol ? ' stage__cols--two' : '')}>{chordBody}</div>
          </div>
        </div>
      )}
    </div>
  )
}
