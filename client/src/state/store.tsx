import type { Session } from '@supabase/supabase-js'
import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState,
  type Dispatch, type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import type { BandState, Role } from '../lib/types'
import { historyReducer, signature, type Action, type HistoryState } from './reducer'

const STORAGE_KEY = 'setsmith:v1'
const LOCAL_KEY = 'setsmith:local'
const BAND_KEY = 'setsmith:band'
const INVITE_KEY = 'setsmith:invite'
const SAVE_DELAY_MS = 700

const emptyState = (): BandState => ({ bandName: 'My band', members: [], songs: {}, shows: [], activeShowId: null })

function load(): BandState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as BandState
  } catch {
    // Storage blocked or corrupt: fall back to a blank band.
  }
  return emptyState()
}

const lsGet = (key: string) => {
  try { return localStorage.getItem(key) } catch { return null }
}
const lsSet = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the choice just won't survive a reload.
  }
}

/** The part of the band data that gets shared; which show a person is looking at stays personal. */

export interface BandInfo { id: string; name: string; role: Role }
export interface AccessRow { userId: string; role: Role; displayName: string }
export interface NowPlaying { showId: string; itemId: string }
export type SyncStatus = 'local' | 'saving' | 'saved' | 'error'
export type Gate = 'app' | 'loading' | 'auth' | 'onboard'

export interface Cloud {
  configured: boolean
  gate: Gate
  userId: string | null
  email: string | null
  bands: BandInfo[]
  band: BandInfo | null
  role: Role | null
  readOnly: boolean
  access: AccessRow[]
  status: SyncStatus
  notice: string | null
  nowPlaying: NowPlaying | null
  setNowPlaying: (showId: string, itemId: string) => void
  dismissNotice: () => void
  goLocal: () => void
  goCloud: () => void
  signOut: () => Promise<void>
  createBand: (name: string) => Promise<string | null>
  joinWithCode: (code: string) => Promise<string | null>
  switchBand: (id: string) => void
  refreshAccess: () => Promise<void>
}

interface Store {
  state: BandState
  dispatch: Dispatch<Action>
  canUndo: boolean
  cloud: Cloud
}

const StoreContext = createContext<Store | null>(null)

const ALWAYS_ALLOWED = new Set<Action['type']>(['selectShow', 'undo', 'replace'])

function readInviteFromUrl(): string | null {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('invite')
  if (!code) return null
  url.searchParams.delete('invite')
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  return code
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [history, rawDispatch] = useReducer(historyReducer, undefined, (): HistoryState => ({ present: load(), past: [] }))
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [localMode, setLocalMode] = useState(() => lsGet(LOCAL_KEY) === '1')
  const [bands, setBands] = useState<BandInfo[] | null>(null)
  const [bandId, setBandId] = useState<string | null>(() => lsGet(BAND_KEY))
  const [dataReady, setDataReady] = useState(false)
  const [access, setAccess] = useState<AccessRow[]>([])
  const [status, setStatus] = useState<SyncStatus>('local')
  const [notice, setNotice] = useState<string | null>(null)
  const [nowPlaying, setNowPlayingState] = useState<NowPlaying | null>(null)

  const userId = session?.user.id ?? null
  const latest = useRef(history.present)
  latest.current = history.present
  const rev = useRef(0)
  const syncedSig = useRef('')
  const saving = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const band = useMemo(() => bands?.find((b) => b.id === bandId) ?? null, [bands, bandId])
  const role = band?.role ?? null
  const readOnly = role === 'viewer'
  const cloudIntent = !!supabase && !!session && !localMode
  const cloudActive = cloudIntent && !!band && dataReady

  useEffect(() => {
    const pending = readInviteFromUrl()
    if (pending) {
      lsSet(INVITE_KEY, pending)
      lsSet(LOCAL_KEY, null)
      setLocalMode(false)
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const refreshBands = useCallback(async () => {
    if (!supabase || !userId) return
    const { data, error } = await supabase
      .from('band_access')
      .select('band_id, role, bands(name)')
      .eq('user_id', userId)
    if (error) {
      setNotice(`Couldn't load your bands: ${error.message}`)
      setBands([])
      return
    }
    setBands(
      (data ?? []).map((r) => {
        const rel = r.bands as unknown as { name: string } | { name: string }[] | null
        const name = Array.isArray(rel) ? rel[0]?.name : rel?.name
        return { id: r.band_id as string, name: name ?? 'Band', role: r.role as Role }
      }),
    )
  }, [userId])

  // Sign-in changes who we are: reload the band list, and redeem an invite that was waiting.
  useEffect(() => {
    if (!supabase || !userId) {
      setBands(null)
      setDataReady(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const code = lsGet(INVITE_KEY)
      if (code && supabase) {
        lsSet(INVITE_KEY, null)
        const { data, error } = await supabase.rpc('accept_invite', { p_code: code })
        if (cancelled) return
        if (error) setNotice('That invite link is invalid or has expired.')
        else {
          setBandId(data as string)
          setNotice('You joined the band.')
        }
      }
      await refreshBands()
    })()
    return () => { cancelled = true }
  }, [userId, refreshBands])

  useEffect(() => {
    if (!bands) return
    if (bands.length && !bands.some((b) => b.id === bandId)) setBandId(bands[0].id)
  }, [bands, bandId])

  const applyRemote = useCallback((data: BandState, nextRev: number) => {
    const current = latest.current
    const keep = data.shows.some((s) => s.id === current.activeShowId)
    const activeShowId = keep ? current.activeShowId : (data.activeShowId ?? data.shows[0]?.id ?? null)
    const next = { ...data, activeShowId }
    rev.current = nextRev
    syncedSig.current = signature(next)
    rawDispatch({ type: 'replace', state: next })
  }, [])

  const fetchBandData = useCallback(async (id: string) => {
    if (!supabase) return false
    const { data, error } = await supabase.from('band_data').select('data, rev').eq('band_id', id).single()
    if (error || !data) {
      setNotice(`Couldn't load the band: ${error?.message ?? 'not found'}`)
      return false
    }
    applyRemote(data.data as BandState, data.rev as number)
    return true
  }, [applyRemote])

  const refreshAccess = useCallback(async () => {
    if (!supabase || !bandId) return
    const { data } = await supabase.from('band_access').select('user_id, role, display_name').eq('band_id', bandId)
    setAccess((data ?? []).map((r) => ({ userId: r.user_id as string, role: r.role as Role, displayName: r.display_name as string })))
  }, [bandId])

  const fetchNowPlaying = useCallback(async (id: string) => {
    if (!supabase) return
    const { data } = await supabase.from('now_playing').select('show_id, item_id').eq('band_id', id).maybeSingle()
    setNowPlayingState(data ? { showId: data.show_id as string, itemId: data.item_id as string } : null)
  }, [])

  // Load the chosen band's document and keep it live.
  const bandRole = band?.id
  useEffect(() => {
    if (!supabase || !userId || localMode || !bandRole) {
      setDataReady(false)
      setNowPlayingState(null)
      return
    }
    const client = supabase
    let cancelled = false
    setDataReady(false)
    setNowPlayingState(null)
    lsSet(BAND_KEY, bandRole)
    ;(async () => {
      const ok = await fetchBandData(bandRole)
      if (cancelled) return
      setDataReady(ok)
      setStatus(ok ? 'saved' : 'error')
      refreshAccess()
      fetchNowPlaying(bandRole)
    })()
    const channel = client
      .channel(`band:${bandRole}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'band_data', filter: `band_id=eq.${bandRole}` }, (payload) => {
        const row = payload.new as { data?: BandState; rev?: number; updated_by?: string }
        if (!row.data || !row.rev || row.updated_by === userId || row.rev <= rev.current) return
        applyRemote(row.data, row.rev)
        setNotice('Updated with changes from your band.')
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'band_access', filter: `band_id=eq.${bandRole}` }, () => {
        refreshAccess()
        refreshBands()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'now_playing', filter: `band_id=eq.${bandRole}` }, (payload) => {
        const row = payload.new as { show_id?: string; item_id?: string } | undefined
        if (row?.show_id && row?.item_id) setNowPlayingState({ showId: row.show_id, itemId: row.item_id })
      })
      .subscribe()
    return () => {
      cancelled = true
      client.removeChannel(channel)
    }
  }, [userId, localMode, bandRole, fetchBandData, applyRemote, refreshAccess, refreshBands, fetchNowPlaying])

  const flush = useCallback(async () => {
    if (!supabase || !bandRole || saving.current) return
    saving.current = true
    try {
      while (signature(latest.current) !== syncedSig.current) {
        const snapshot = latest.current
        const { data, error } = await supabase.rpc('save_band_data', {
          p_band: bandRole, p_data: snapshot, p_expected: rev.current,
        })
        if (error) {
          setStatus('error')
          setNotice(`Couldn't save: ${error.message}`)
          return
        }
        if (data === -1) {
          await fetchBandData(bandRole)
          setStatus('saved')
          setNotice('Someone else saved first, so your last edit was replaced by their version.')
          return
        }
        rev.current = data as number
        syncedSig.current = signature(snapshot)
      }
      setStatus('saved')
    } finally {
      saving.current = false
    }
  }, [bandRole, fetchBandData])

  useEffect(() => {
    if (!cloudIntent) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history.present))
      } catch {
        // Nothing to do: the app keeps working in memory.
      }
      return
    }
    if (!cloudActive || readOnly || signature(history.present) === syncedSig.current) return
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY_MS)
    return () => clearTimeout(timer.current)
  }, [history.present, cloudIntent, cloudActive, readOnly, flush])

  useEffect(() => {
    if (!cloudActive) setStatus('local')
  }, [cloudActive])

  const dispatch = useCallback<Dispatch<Action>>((action) => {
    if (readOnly && !ALWAYS_ALLOWED.has(action.type)) return
    rawDispatch(action)
  }, [readOnly])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const local = load()
    await supabase.auth.signOut()
    setBandId(null)
    lsSet(BAND_KEY, null)
    rawDispatch({ type: 'replace', state: local })
  }, [])

  const createBand = useCallback(async (name: string) => {
    if (!supabase || !session) return 'Sign in first.'
    const clean = name.trim()
    if (!clean) return 'Give the band a name.'
    const fresh: BandState = { bandName: clean, members: [], songs: {}, shows: [], activeShowId: null }
    const hasLocalWork = lsGet(STORAGE_KEY) !== null
    const seed = cloudActive || !hasLocalWork ? fresh : { ...latest.current, bandName: clean }
    const display = session.user.email?.split('@')[0] ?? ''
    const { data, error } = await supabase.rpc('create_band', { p_name: clean, p_data: seed, p_display: display })
    if (error) return error.message
    await refreshBands()
    setBandId(data as string)
    return null
  }, [session, cloudActive, refreshBands])

  const joinWithCode = useCallback(async (raw: string) => {
    if (!supabase) return 'Not configured.'
    const code = raw.trim().split('invite=').pop()?.trim() ?? ''
    if (!code) return 'Paste the invite code or link.'
    const { data, error } = await supabase.rpc('accept_invite', { p_code: code })
    if (error) return 'That invite is invalid or has expired.'
    await refreshBands()
    setBandId(data as string)
    return null
  }, [refreshBands])

  const setNowPlaying = useCallback((showId: string, itemId: string) => {
    if (!supabase || !bandRole || readOnly) return
    setNowPlayingState({ showId, itemId })
    supabase.rpc('set_now_playing', { p_band: bandRole, p_show: showId, p_item: itemId }).then(({ error }) => {
      if (error) setNotice(`Couldn't update the stage: ${error.message}`)
    })
  }, [bandRole, readOnly])

  const goLocal = useCallback(() => {
    lsSet(LOCAL_KEY, '1')
    setLocalMode(true)
    rawDispatch({ type: 'replace', state: load() })
  }, [])

  const goCloud = useCallback(() => {
    lsSet(LOCAL_KEY, null)
    setLocalMode(false)
  }, [])

  let gate: Gate = 'app'
  if (supabase && !localMode) {
    if (!authReady) gate = 'loading'
    else if (!session) gate = 'auth'
    else if (bands === null) gate = 'loading'
    else if (bands.length === 0) gate = 'onboard'
    else if (!dataReady) gate = 'loading'
  }

  const cloud: Cloud = {
    configured: !!supabase, gate, userId, email: session?.user.email ?? null, bands: bands ?? [], band, role, readOnly,
    access, status, notice, nowPlaying, setNowPlaying, dismissNotice: () => setNotice(null), goLocal, goCloud, signOut, createBand,
    joinWithCode, switchBand: setBandId, refreshAccess,
  }

  return (
    <StoreContext.Provider value={{ state: history.present, dispatch, canUndo: history.past.length > 0, cloud }}>
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
