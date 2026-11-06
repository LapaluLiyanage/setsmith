import { Capacitor } from '@capacitor/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Landing from './components/Landing'
import { SharedView } from './components/SharedView'
import './index.css'
import { StoreProvider } from './state/store'

const params = new URLSearchParams(window.location.search)
const shareToken = params.get('share')

// The public landing page lives at "/". The app is at "/app". Old links that point at "/" with an
// invite/share/join code, the installed PWA and the native shells all still go straight to the app.
const isAppPath = /^\/app(\/|$)/.test(window.location.pathname)
const showLanding = !isAppPath && !shareToken && !params.has('invite') && !params.has('join') && !Capacitor.isNativePlatform()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showLanding ? (
      <Landing />
    ) : shareToken ? (
      <SharedView token={shareToken} />
    ) : (
      <StoreProvider>
        <App />
      </StoreProvider>
    )}
  </StrictMode>,
)
