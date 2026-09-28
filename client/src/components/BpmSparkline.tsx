interface Props {
  values: (number | null)[]
}

const W = 160
const H = 36
const PAD = 4

/** Tempo across a session, song by song. Gaps are songs without a BPM yet. */
export function BpmSparkline({ values }: Props) {
  const known = values.filter((v): v is number => v != null)
  if (known.length < 2) return <div className="spark spark--empty">Add BPMs to see the energy curve</div>

  const min = Math.min(...known) - 5
  const max = Math.max(...known) + 5
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, values.length - 1)
  const y = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2)
  const points = values.map((v, i) => (v == null ? null : [x(i), y(v)] as const))
  const path = points
    .filter((p): p is readonly [number, number] => p != null)
    .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(' ')

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tempo ${known.join(', ')} BPM`}>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="var(--accent)" />)}
    </svg>
  )
}
