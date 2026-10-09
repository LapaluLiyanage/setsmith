import { Capacitor } from '@capacitor/core'

/** True inside the iOS / Android app (Capacitor), false in a normal browser. */
export const isNative = Capacitor.isNativePlatform()

/** Keep the screen on (on stage the phone must not sleep). Returns a function that releases it. */
export function keepScreenAwake(): () => void {
  if (!isNative) return () => {}
  let released = false
  import('@capacitor-community/keep-awake')
    .then(({ KeepAwake }) => (released ? undefined : KeepAwake.keepAwake()))
    .catch(() => {})
  return () => {
    released = true
    import('@capacitor-community/keep-awake').then(({ KeepAwake }) => KeepAwake.allowSleep()).catch(() => {})
  }
}

/** Light tap feedback when the song changes; no-op in the browser. */
export function tapHaptic(): void {
  if (!isNative) return
  import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })).catch(() => {})
}
