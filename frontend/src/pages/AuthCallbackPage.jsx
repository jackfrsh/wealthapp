import { useEffect } from 'react'
import { supabase } from '../supabase'
import { useApp } from '../App'

export default function AuthCallbackPage() {
  const { setPage, showToast } = useApp()

  useEffect(() => {
    let cancelled = false
    let timeoutId = null

    const finishSuccess = () => {
      if (cancelled) return
      showToast?.('Signed in with Google.', 'success')
      setPage?.('home')
    }

    const finishFailure = (error) => {
      if (cancelled) return
      console.error('Google callback failed:', error)
      showToast?.('Could not complete Google sign-in.', 'error')
      setPage?.('auth')
    }

    const run = async () => {
      try {
        if (!supabase) throw new Error('Supabase is not configured.')

        const first = await supabase.auth.getSession()
        if (first?.data?.session) {
          finishSuccess()
          return
        }

        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            listener?.subscription?.unsubscribe?.()
            finishSuccess()
          }
        })

        timeoutId = window.setTimeout(async () => {
          try {
            listener?.subscription?.unsubscribe?.()

            const second = await supabase.auth.getSession()
            if (second?.data?.session) {
              finishSuccess()
              return
            }

            finishFailure(new Error('Session was not established after callback.'))
          } catch (e) {
            finishFailure(e)
          }
        }, 1500)
      } catch (e) {
        finishFailure(e)
      }
    }

    run()

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [setPage, showToast])

  return (
    <div className="min-h-screen flex items-center justify-center brand-auth-bg text-ink dark:text-white">
      <div className="text-sm text-ink-muted dark:text-white/50">
        Completing sign-in…
      </div>
    </div>
  )
}