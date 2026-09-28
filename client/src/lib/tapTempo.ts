/** Gap after which a tap starts a fresh measurement. */
export const TAP_RESET_MS = 2000
const MAX_TAPS = 8

/**
 * Add a tap timestamp and return the new tap list.
 * Starts over if the drummer paused, and keeps only the most recent taps.
 */
export function addTap(taps: number[], now: number): number[] {
  const last = taps[taps.length - 1]
  if (last !== undefined && now - last > TAP_RESET_MS) return [now]
  return [...taps, now].slice(-MAX_TAPS)
}

/** BPM from the average gap between taps; null until there are two taps. */
export function bpmFromTaps(taps: number[]): number | null {
  if (taps.length < 2) return null
  const avgGap = (taps[taps.length - 1] - taps[0]) / (taps.length - 1)
  return avgGap > 0 ? Math.round(60000 / avgGap) : null
}
