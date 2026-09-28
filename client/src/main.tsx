import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SharedView } from './components/SharedView'
import './index.css'
import { StoreProvider } from './state/store'

const shareToken = new URLSearchParams(window.location.search).get('share')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {shareToken ? (
      <SharedView token={shareToken} />
    ) : (
      <StoreProvider>
        <App />
      </StoreProvider>
    )}
  </StrictMode>,
)
