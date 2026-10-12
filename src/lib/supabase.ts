import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// The anon key is public by design; row-level security in the database
// restricts every table to the signed-in user's own rows.
export const supabase = createClient(url || 'http://localhost', anonKey || 'missing')
