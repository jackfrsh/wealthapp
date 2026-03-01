import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// If either value is missing, export null so the app can fail gracefully.
const hasCreds = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasCreds
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Vite runs in browser; keep localStorage
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        storageKey: "wealthapp-auth",
      },
    })
  : null;

// Also provide a default export so imports won't break if some file uses default import.
export default supabase;

// Expose to devtools in development only
if (typeof window !== "undefined" && import.meta.env.DEV) {
  window.supabase = supabase;
}