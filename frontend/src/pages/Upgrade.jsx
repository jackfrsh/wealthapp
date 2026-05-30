import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../App'
import UpgradeButton from '../components/UpgradeButton'
import { track } from '../track'
import { Crown, ShieldCheck, Check } from 'lucide-react'

function withTimeout(promise, ms = 3500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export default function Upgrade() {
  const { setPage, isPro, api, setIsPro, refreshSettings, syncBilling } = useApp()

  const [isLoading, setIsLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [isError, setIsError] = useState(false)
  const [plan, setPlan] = useState('annual')

  const reason = useMemo(() => {
    try {
      return localStorage.getItem('upgrade_reason') || ''
    } catch {
      return ''
    }
  }, [])

  const isAccountLimit = reason === 'account_limit'

  const returnRanRef = useRef(false)
  const trackedViewRef = useRef(false)

  useEffect(() => {
    if (trackedViewRef.current) return
    trackedViewRef.current = true

    track('page_view', {
      page: 'upgrade',
    })

    track('upgrade_viewed', {
      page: 'upgrade',
      reason,
    })
  }, [reason])

  useEffect(() => {
    let cancelled = false
    if (returnRanRef.current) return
    returnRanRef.current = true

    const url = new URL(window.location.href)
    const success = url.searchParams.get('success') === 'true'
    const cancel = url.searchParams.get('cancel') === 'true'
    const sessionId = url.searchParams.get('session_id') || ''

    const cleanUrlNow = () => {
      try {
        url.searchParams.delete('success')
        url.searchParams.delete('cancel')
        url.searchParams.delete('session_id')
        window.history.replaceState({}, '', url.toString())
      } catch {}
    }

    if (success || cancel) cleanUrlNow()

    const run = async () => {
      if (!success && !cancel) return

      if (cancel) {
        if (cancelled) return
        setStatusMsg('Checkout cancelled.')
        return
      }

      if (cancelled) return
      setStatusMsg('Finalising your upgrade…')

      let verified = false
      if (sessionId) {
        try {
          const r = await withTimeout(
            api(`/billing/checkout-status?session_id=${encodeURIComponent(sessionId)}`),
            2500
          )
          if (cancelled) return
          if (r?.paid) {
            verified = true
            setIsPro?.(true)
            setStatusMsg('Activated — syncing your account…')
          }
        } catch {}
      }

      try {
        setStatusMsg('Syncing billing…')
        if (typeof syncBilling === 'function') {
          await withTimeout(syncBilling(), 4500)
        } else {
          await withTimeout(api('/billing/sync', { method: 'POST' }), 4500)
        }
      } catch {}
      if (cancelled) return

      let s = null
      try {
        setStatusMsg('Updating your plan…')
        s =
          typeof refreshSettings === 'function'
            ? await withTimeout(refreshSettings({ force: true }), 4500)
            : await withTimeout(api('/settings'), 4500)
      } catch {}
      if (cancelled) return

      const proNow = !!s?.is_pro || verified || !!isPro
      setIsPro?.(proNow)
      setStatusMsg(proNow ? 'Pro activated ✓ Loading your dashboard…' : 'Payment received — activation may take a moment.')

      try {
        setTimeout(() => {
          if (cancelled) return
          window.location.replace('/home')
        }, 350)
      } catch {
        setPage?.('home', { replace: true })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [api, refreshSettings, syncBilling, setIsPro, isPro, setPage])

  const handleUpgrade = async () => {
    if (isLoading) return
    setIsLoading(true)
    setIsError(false)
    setStatusMsg('Starting checkout…')

    if (import.meta.env.DEV) console.log('[upgrade] upgrade_click', { plan })

    try {
      try { localStorage.setItem('upgrade_reason', 'upgrade_cta') } catch {}

      // Await track so it does not race the checkout POST through the same
      // token pipeline — a concurrent 401 from /events would fire session-expired
      // and log the user out before the checkout redirect lands.
      try {
        await track('upgrade_clicked', {
          page: 'upgrade',
          source: 'checkout_cta',
          plan,
          reason,
        })
      } catch {}

      if (import.meta.env.DEV) console.log('[upgrade] checkout_request_start', { plan })

      const res = await api('/billing/create-checkout', {
        method: 'POST',
        body: { plan },
      })

      // Handle both { url } (current backend) and { checkout_url } (defensive)
      const checkoutUrl = res?.url || res?.checkout_url

      if (checkoutUrl) {
        if (import.meta.env.DEV) console.log('[upgrade] checkout_request_success', { checkoutUrl })
        window.location.assign(checkoutUrl)
        return
      }

      if (import.meta.env.DEV) console.warn('[upgrade] checkout_request_failed — no URL in response', res)
      throw new Error("We couldn't start checkout. Please try again.")
    } catch (err) {
      if (import.meta.env.DEV) console.error('[upgrade] checkout_request_failed', err)
      setIsError(true)
      setStatusMsg(err?.message || "We couldn't start checkout. Please try again.")
      setIsLoading(false)
    }
  }

  const price = plan === 'monthly' ? '£6' : '£60'
  const cadence = plan === 'monthly' ? '/month' : '/year'

  const headline = isAccountLimit ? 'More accounts, deeper intelligence.' : 'See when your plan gets you there.'
  const subhead = isAccountLimit
    ? 'Free supports up to 3 accounts. Pro unlocks unlimited accounts, long-horizon projections, and your full freedom timeline.'
    : 'Your freedom timeline, 40-year projections, scenario modelling, and the planning depth to close the gap.'

    const proBullets = [
      'Freedom timeline — see when your plan gets you there',
      'Unlimited accounts',
      '5–40 year projections with milestone markers',
      'Contribution optimiser — see what it takes to stay on track',
      'Scenario compare — test changes side by side',
      'One-off deposit modelling — see the impact of lump sums',
      'Real-terms (inflation-adjusted) projections',
      'All insights unlocked',
    ]

  return (
    <div className="space-y-10">
      <div className="text-center space-y-3">
        <div className="text-xs font-semibold tracking-[.18em] uppercase text-ink-muted/50 dark:text-white/25">
          Paddock Pro
        </div>

        <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-ink dark:text-white">
          {headline}
        </h1>

        <p className="text-sm sm:text-base text-ink-muted/70 dark:text-white/35 max-w-xl mx-auto">
          {subhead}
        </p>

        {!!statusMsg && (
          <div
            role={isError ? 'alert' : undefined}
            className={`mt-3 text-sm font-medium ${
              isError
                ? 'text-red-500 dark:text-red-400'
                : 'text-ink-muted/70 dark:text-white/35'
            }`}
          >
            {statusMsg}
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto">
        <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-white/5 shadow-[0_20px_40px_rgba(0,0,0,.08)] p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="text-lg font-semibold text-ink dark:text-white flex items-center justify-center gap-2">
              <Crown size={18} className="text-amber-500" />
              Paddock Pro
            </div>

            <div className="inline-flex p-1 rounded-2xl border border-black/[.08] dark:border-white/[.10] bg-black/[.02] dark:bg-white/[.06]">
              <button
                onClick={() => { setPlan('monthly'); setIsError(false); setStatusMsg('') }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  plan === 'monthly'
                    ? 'bg-white dark:bg-surface-dark text-ink dark:text-white shadow-sm'
                    : 'text-ink-muted dark:text-white/45 hover:text-ink dark:hover:text-white'
                }`}
                type="button"
              >
                Monthly
              </button>

              <button
                onClick={() => { setPlan('annual'); setIsError(false); setStatusMsg('') }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  plan === 'annual'
                    ? 'bg-white dark:bg-surface-dark text-ink dark:text-white shadow-sm'
                    : 'text-ink-muted dark:text-white/45 hover:text-ink dark:hover:text-white'
                }`}
                type="button"
              >
                Annual
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-4xl font-display tracking-tight text-ink dark:text-white">
                {price}
                <span className="text-base font-medium text-ink-muted/50 dark:text-white/25">
                  {' '}
                  {cadence}
                </span>
              </div>

              <div className="text-xs text-ink-muted/60 dark:text-white/30">
                {plan === 'annual' ? 'Annual includes a 7-day trial.' : 'Monthly has no trial. Switch to annual anytime.'}
              </div>
            </div>

            <div className="text-xs text-ink-muted/60 dark:text-white/30 flex items-center justify-center gap-2">
              <ShieldCheck size={14} />
              Secure checkout powered by Stripe.
            </div>
          </div>

          <div className="space-y-3 text-sm">
            {proBullets.map((t) => (
              <div key={t} className="flex items-start gap-2">
                <span className="mt-0.5">
                  <Check size={16} className="opacity-70" />
                </span>
                <span className="text-ink dark:text-white/80">{t}</span>
              </div>
            ))}

            <div className="pt-2 text-xs text-ink-muted/60 dark:text-white/30">
              Coming soon: pensions tools and pension bridge.
            </div>
          </div>

          {!isPro ? (
            <UpgradeButton onClick={handleUpgrade} size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? 'Redirecting…' : 'Upgrade'}
            </UpgradeButton>
          ) : (
            <button
              onClick={() => setPage('home')}
              className="w-full px-6 py-4 rounded-2xl text-sm font-semibold bg-surface-2 dark:bg-white/[.06] text-ink dark:text-white hover:opacity-90 transition-opacity"
              type="button"
            >
              You’re Pro ✓
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="rounded-3xl border border-black/[.06] dark:border-white/[.08] bg-white/60 dark:bg-white/[.04] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink dark:text-white text-center">Free vs Pro</h2>
          <p className="text-sm text-ink-muted/70 dark:text-white/35 text-center mt-2">
            Free gives you core clarity. Pro gives you the depth to act on it.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.04] p-5">
              <div className="text-sm font-semibold text-ink dark:text-white">Free</div>
              <ul className="mt-3 space-y-2 text-sm text-ink-muted dark:text-white/45">
                <li>Up to 3 accounts</li>
                <li>1-year projection</li>
                <li>One goal</li>
                <li>All 4 decision tools</li>
                <li>2 insights</li>
                <li>Core net worth dashboard</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-black/[.08] dark:border-white/[.10] bg-black/[.02] dark:bg-white/[.06] p-5">
              <div className="text-sm font-semibold text-ink dark:text-white flex items-center gap-2">
                <Crown size={16} className="text-amber-500" />
                Pro
              </div>
              <ul className="mt-3 space-y-2 text-sm text-ink dark:text-white/80">
                <li>Unlimited accounts</li>
                <li>Freedom timeline</li>
                <li>5–40 year projections + milestones</li>
                <li>Scenario compare &amp; one-off deposit modelling</li>
                <li>Required contribution optimiser</li>
                <li>Real-terms view + all insights</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setPage('home')}
              className="text-sm font-semibold text-ink-muted dark:text-white/45 hover:text-ink dark:hover:text-white transition-colors"
            >
              Not now — continue free
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}