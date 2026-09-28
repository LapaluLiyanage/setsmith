import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react'
import type { BandState } from '../lib/types'
import { historyReducer, type Action, type HistoryState } from './reducer'
import { sampleState } from './sampleData'

// Local save until Supabase is wired in (see supabase/schema.sql).
const STORAGE_KEY = 'setsmith:v1'

function load(): BandState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as BandState
  } catch {
    // Storage blocked or corrupt: fall back to the sample band.
  }
  return sampleState
}

interface Store {
  state: BandState
  dispatch: Dispatch<Action>
  canUndo: boolean
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [history, dispatch] = useReducer(historyReducer, undefined, (): HistoryState => ({ present: load(), past: [] }))

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.present))
    } catch {
      // Nothing to do: the app keeps working in memory.
    }
  }, [history.present])

  return (
    <StoreContext.Provider value={{ state: history.present, dispatch, canUndo: history.past.length > 0 }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`
