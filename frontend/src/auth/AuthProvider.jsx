import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Restore existing session from storage
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.warn("getSession error:", error.message);
        if (!mounted) return;
        setSession(data?.session ?? null);
        setLoading(false);
      })
      .catch((e) => {
        console.warn("getSession exception:", e);
        if (!mounted) return;
        setSession(null);
        setLoading(false);
      });

    // Listen for login/logout/refresh
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => {
    return {
      loading,
      session,
      user: session?.user ?? null,
      signOut: () => {
  // fire-and-forget
  supabase.auth.signOut().catch(() => {})
},
    };
  }, [loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
