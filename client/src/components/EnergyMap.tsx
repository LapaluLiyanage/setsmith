import { gsap } from 'gsap'
import { useEffect, useRef } from 'react'
import { reducedMotion } from '../lib/motion'
import type { Session, Song } from '../lib/types'
import type { Theme } from '../state/theme'

// Session colours for the bars. The third (Encore in the design) flips so it stays visible on the dark theme.
const LIGHT = [0xc3c7bd, 0xd6e83a, 0x1f2124, 0x9fb8d9, 0xf0b38a]
const DARK = [0x6d716b, 0xd6e83a, 0xecede8, 0x7d98bd, 0xd9946a]
export const sessionColor = (i: number, theme: Theme) => {
  const hex = (theme === 'dark' ? DARK : LIGHT)[i % LIGHT.length]
  return `#${hex.toString(16).padStart(6, '0')}`
}

interface Props {
  sessions: Session[]
  songs: Record<string, Song>
  theme: Theme
}

type Three = typeof import('three')

/**
 * 3D "Energy map": one bar per song in play order, height = BPM, coloured by session,
 * with a tube tracing the tempo line. Three.js is loaded only when this mounts.
 */
export function EnergyMap({ sessions, songs, theme }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    T: Three
    renderer: import('three').WebGLRenderer
    scene: import('three').Scene
    camera: import('three').PerspectiveCamera
    group: import('three').Group
    grid: import('three').GridHelper
    raf: number
  } | null>(null)

  // Bars to draw: [bpm or null, session index]
  const bars = sessions.flatMap((s, si) => s.items.map((i) => [songs[i.songId]?.bpm ?? null, si] as const))
  const signature = JSON.stringify(bars) + theme

  // Set up renderer once.
  useEffect(() => {
    let disposed = false
    let resize: ResizeObserver | null = null
    import('three').then((T) => {
      const host = hostRef.current
      if (disposed || !host) return
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(2, devicePixelRatio))
      host.appendChild(renderer.domElement)
      const scene = new T.Scene()
      const camera = new T.PerspectiveCamera(30, 1, 0.1, 100)
      camera.position.set(0, 3.2, 11)
      camera.lookAt(0, 0.9, 0)
      scene.add(new T.HemisphereLight(0xffffff, 0x9a9e90, 1.4))
      const light = new T.DirectionalLight(0xffffff, 1.6)
      light.position.set(4, 7, 5)
      scene.add(light)
      const grid = new T.GridHelper(14, 28, 0xc9ccc2, 0xdcded6)
      grid.position.y = -0.31
      scene.add(grid)
      const group = new T.Group()
      group.position.y = -0.3
      scene.add(group)

      const fit = () => {
        const w = host.clientWidth
        const h = host.clientHeight
        if (!w || !h) return
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      fit()
      resize = new ResizeObserver(fit)
      resize.observe(host)

      const still = reducedMotion()
      const loop = (t: number) => {
        const s = sceneRef.current
        if (!s) return
        if (!still) group.rotation.y = Math.sin(t / 3500) * 0.28
        renderer.render(scene, camera)
        s.raf = requestAnimationFrame(loop)
      }
      sceneRef.current = { T, renderer, scene, camera, group, grid, raf: requestAnimationFrame(loop) }
      host.dataset.ready = '1'
      host.dispatchEvent(new Event('energy-ready'))
    })
    return () => {
      disposed = true
      resize?.disconnect()
      const s = sceneRef.current
      if (s) {
        cancelAnimationFrame(s.raf)
        s.group.traverse((o) => {
          const mesh = o as import('three').Mesh
          mesh.geometry?.dispose()
          ;(mesh.material as import('three').Material | undefined)?.dispose?.()
        })
        s.renderer.dispose()
        s.renderer.domElement.remove()
      }
      sceneRef.current = null
    }
  }, [])

  // Rebuild bars whenever the running order, tempos or theme change.
  useEffect(() => {
    let cancelled = false
    const build = () => {
      const s = sceneRef.current
      if (!s || cancelled) return
      const { T, group, grid } = s
      group.children.slice().forEach((o) => {
        gsap.killTweensOf([o.scale, o.position])
        group.remove(o)
        const mesh = o as import('three').Mesh
        mesh.geometry?.dispose()
        ;(mesh.material as import('three').Material).dispose()
      })
      const dark = theme === 'dark'
      ;(grid.material as import('three').Material).opacity = dark ? 0.25 : 1
      ;(grid.material as import('three').Material).transparent = dark

      const n = bars.length
      if (!n) return
      const gap = Math.min(0.95, 9 / n)
      const points: import('three').Vector3[] = []
      const animate = !reducedMotion()
      bars.forEach(([bpm, si], i) => {
        const known = bpm != null
        const height = known ? ((Math.min(160, Math.max(60, bpm)) - 60) / 80) * 2.6 + 0.25 : 0.12
        const x = (i - (n - 1) / 2) * gap
        const bar = new T.Mesh(
          new T.BoxGeometry(gap * 0.55, height, gap * 0.55),
          new T.MeshStandardMaterial({
            color: (dark ? DARK : LIGHT)[si % LIGHT.length], roughness: 0.55,
            transparent: !known, opacity: known ? 1 : 0.35,
          }),
        )
        bar.geometry.translate(0, height / 2, 0)
        bar.position.x = x
        group.add(bar)
        if (!known) return
        const ball = new T.Mesh(
          new T.SphereGeometry(gap * 0.2, 20, 16),
          new T.MeshStandardMaterial({ color: dark ? 0xecede8 : 0xffffff, roughness: 0.3 }),
        )
        ball.position.set(x, height + 0.25, 0)
        group.add(ball)
        points.push(new T.Vector3(x, height + 0.25, 0))
        if (animate) {
          gsap.fromTo(bar.scale, { y: 0.001 }, { y: 1, duration: 0.9, ease: 'power3.out', delay: i * 0.05 })
          gsap.fromTo(ball.position, { y: 0.25 }, { y: height + 0.25, duration: 0.9, ease: 'power3.out', delay: i * 0.05 })
        }
      })
      if (points.length > 1) {
        group.add(new T.Mesh(
          new T.TubeGeometry(new T.CatmullRomCurve3(points), 80, 0.03, 8),
          new T.MeshStandardMaterial({ color: dark ? 0xe2f24a : 0x1f2124 }),
        ))
      }
    }
    const host = hostRef.current
    if (sceneRef.current) build()
    else host?.addEventListener('energy-ready', build, { once: true })
    return () => {
      cancelled = true
      host?.removeEventListener('energy-ready', build)
    }
    // signature captures everything bars/theme depend on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return (
    <div className="energy" role="img" aria-label={`Energy map: tempo of ${bars.length} songs in play order`}>
      <div ref={hostRef} className="energy__canvas" />
      <div className="energy__label"><b>Energy map</b><span>BPM per song, in play order</span></div>
      <div className="energy__legend">
        {sessions.map((s, i) => <span key={s.id}><i style={{ background: sessionColor(i, theme) }} />{s.name}</span>)}
      </div>
      {bars.length === 0 && <div className="energy__empty">Add songs to see the energy map</div>}
    </div>
  )
}
