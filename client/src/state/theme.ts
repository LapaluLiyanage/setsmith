import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'setsmith:theme'

function initial(): Theme {
  const set = document.documentElement.dataset.theme
  return set === 'dark' ? 'dark' : 'light'
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initial)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c0d0e' : '#e3e5df')
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // Theme just won't be remembered.
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}
