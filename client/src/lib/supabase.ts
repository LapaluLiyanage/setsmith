import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** Null when no project is configured: the app then runs local-only. */
export const supabase = url && key ? createClient(url, key) : null
