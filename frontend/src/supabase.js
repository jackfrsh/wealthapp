import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// If either value is missing, create a dummy client that won't crash the app.
// Auth calls will fail gracefully, and the API layer will fall back to the
// legacy token stored in localStorage.
const _hasCreds = !!(supabaseUrl && supabaseAnonKey);

export const supabase = _hasCreds
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: "wealthapp-auth",
      },
    })
  : null;

if (typeof window !== "undefined") {
  window.supabase = supabase;
}
