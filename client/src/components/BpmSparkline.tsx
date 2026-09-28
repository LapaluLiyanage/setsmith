interface Props {
  values: (number | null)[]
}

/** Session tempo curve: lime area under a dark line, one dot per song (design: session card). */
export function BpmSparkline({ values }: Props) {
  const known = values.filter((v): v is number => v != null)
  if (known.length === 0) {
    return <div className="spark"><div className="spark__empty">Add BPMs to see the tempo curve</div></div>
  }

  const n = values.length
  // Plot in a 100 × 32 box; 60–140 BPM spans the height like the design.
  const pts = values.flatMap((v, i) => {
    if (v == null) return []
    const x = n === 1 ? 50 : (i / (n - 1)) * 100
    const y = 30 - ((Math.min(140, Math.max(60, v)) - 60) / 80) * 26
    return [[x, y] as const]
  })
  const line = pts.map((p) => p.join(',')).join(' ')
  const area = `${pts[0][0]},32 ${line} ${pts[pts.length - 1][0]},32`

  return (
    <div className="spark">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
        <polygon points={area} style={{ fill: 'var(--ac)', opacity: 0.85 }} />
        <polyline points={line} style={{ fill: 'none', stroke: 'var(--tx)', strokeWidth: 1.5 }} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="spark__dots" aria-hidden>
        {pts.map(([x, y], i) => <i key={i} style={{ left: `${x}%`, top: `${(y / 32) * 100}%` }} />)}
      </div>
      <span className="spark__range">{Math.min(...known)}–{Math.max(...known)} bpm</span>
    </div>
  )
}
