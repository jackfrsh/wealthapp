// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'
console.log('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL)
console.log('VITE_SUPABASE_ANON_KEY?', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('Missing Supabase environment variables.')
  console.error('Expected:')
  console.error('  VITE_SUPABASE_URL')
  console.error('  VITE_SUPABASE_ANON_KEY')
  throw new Error('Supabase not configured.')
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})