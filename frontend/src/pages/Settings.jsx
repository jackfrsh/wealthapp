import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import UpgradeButton from '../components/UpgradeButton'
import { track } from '../track'
import { CURRENCIES } from '../utils'
import {
  RefreshCw,
  Save,
  Globe,
  Crown,
  CreditCard,
  ChevronRight,
  Mail,
} from 'lucide-react'

const CURRENCY_NAMES = {
  GBP: 'British Pound',
  USD: 'US Dollar',
  EUR: 'Euro',
  CHF: 'Swiss Franc',
  AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar',
  JPY: 'Japanese Yen',
  SEK: 'Swedish Krona',
  NOK: 'Norwegian Krone',
  SGD: 'Singapore Dollar',
  NZD: 'New Zealand Dollar',
  HKD: 'Hong Kong Dollar',
  INR: 'Indian Rupee',
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
}

function billingLabel(status) {
  if (!status) return ''
  if (status === 'active') return 'Active'
  if (status === 'trialing') return 'Trial'
  if (status === 'past_due') return 'Payment issue'
  if (status === 'canceled') return 'Cancelled'
  if (status === 'incomplete') return 'Incomplete'
  if (status === 'incomplete_expired') return 'Expired'
  if (status === 'unpaid') return 'Unpaid'
  return status
}

export default function Settings() {
  const {
    api,
    username,
    baseCurrency,
    setBaseCurrency,
    showToast,
    isPro,
    setIsPro,
    refreshSettings,
    setPage,
  } = useApp()

  const [currency, setCurrency] = useState((baseCurrency || 'GBP').toUpperCase())

  useEffect(() => {
    track('page_view', { page: 'settings' })
  }, [])

  useEffect(() => {
    setCurrency((baseCurrency || 'GBP').toUpperCase())
  }, [baseCurrency])

  const [fxStatus, setFxStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const [billingBusy, setBillingBusy] = useState(false)
  const [billingMsg, setBillingMsg] = useState('')
  const [subStatus, setSubStatus] = useState('')

  const IS_DEV = !!import.meta?.env?.DEV
  const subLabel = useMemo(() => billingLabel(subStatus), [subStatus])

  const settingsPanelStyle = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.012) 100%)',
    border: '1px solid rgba(255,255,255,0.055)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.018)',
  }

  const adminEmails = useMemo(() => {
    const raw = (import.meta?.env?.VITE_ADMIN_EMAILS || '').trim()
    if (!raw) return new Set()
    return new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  }, [])

  const isAdmin = useMemo(() => {
    if (!username) return false
    return adminEmails.has(String(username).toLowerCase())
  }, [adminEmails, username])

  const utilityGridClass = useMemo(() => {
    const count = 1 + (isAdmin ? 1 : 0) + (IS_DEV ? 1 : 0)
    if (count === 1) return 'grid grid-cols-1 gap-4'
    if (count === 2) return 'grid grid-cols-1 lg:grid-cols-2 gap-4'
    return 'grid grid-cols-1 lg:grid-cols-3 gap-4'
  }, [isAdmin, IS_DEV])

  const goUpgrade = useCallback(
    (source = 'settings_cta') => {
      track('upgrade_clicked', {
        page: 'settings',
        source,
      })

      try {
        localStorage.setItem('upgrade_reason', source)
      } catch {}

      setPage('upgrade')
    },
    [setPage]
  )

  const saveCurrency = async () => {
    setSaving(true)
    try {
      await api('/settings', { method: 'PUT', body: { base_currency: currency } })
      setBaseCurrency?.(currency)
      showToast?.('Settings saved', 'success')
      await refreshSettings?.({ force: true })

      track('settings_updated', {
        page: 'settings',
        source: 'base_currency',
      })
    } catch (e) {
      showToast?.(e?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const refreshFx = async () => {
    setFxStatus('Updating…')
    try {
      const data = await api(`/fx/refresh?base=${currency}`)
      const rates = data?.rates || {}
      const sample = Object.entries(rates)
        .filter(([k]) => ['USD', 'EUR', 'GBP'].includes(k))
        .map(([k, v]) => `${k}: ${Number(v).toFixed(4)}`)
        .join('  ·  ')
      setFxStatus(`Updated ${data?.date || ''} · ${sample}`)
      showToast?.('FX rates refreshed', 'success')
    } catch (e) {
      setFxStatus(`Failed: ${e?.message || 'unknown error'}`)
      showToast?.(e?.message || 'Failed to refresh FX', 'error')
    }
  }

  const openPortal = async () => {
    setBillingBusy(true)
    setBillingMsg('Opening billing portal…')
    try {
      const res = await api('/billing/portal', { method: 'POST' })
      if (res?.url) {
        track('billing_portal_opened', {
          page: 'settings',
          source: 'manage_billing',
        })

        window.location.href = res.url
        return
      }
      throw new Error('No portal URL returned')
    } catch (e) {
      console.error(e)
      setBillingMsg('')
      showToast?.('Could not open billing portal. Please try again.', 'error')
      setBillingBusy(false)
    }
  }

  const refreshProStatus = async () => {
    setBillingBusy(true)
    setBillingMsg('Checking subscription status…')
    try {
      const r = await api('/billing/sync', { method: 'POST' })
      if (r && typeof r === 'object') {
        setIsPro?.(!!r.is_pro)
        setSubStatus(r.status || '')
      } else if (typeof refreshSettings === 'function') {
        const s = await refreshSettings({ force: true })
        setIsPro?.(!!s?.is_pro)
      }

      if (r?.status === 'past_due') setBillingMsg('Payment issue — update card in billing portal.')
      else setBillingMsg(r?.is_pro ? 'Pro active ✓' : 'Free plan')
    } catch (e) {
      console.error(e)
      setBillingMsg('')
      showToast?.('Could not refresh status. Try again.', 'error')
    } finally {
      setTimeout(() => setBillingMsg(''), 2200)
      setBillingBusy(false)
    }
  }

  const devTogglePro = async () => {
    if (!IS_DEV) return
    const newValue = !isPro
    setBillingBusy(true)
    setBillingMsg('Updating…')
    try {
      await api('/settings', { method: 'PUT', body: { is_pro: newValue } })
      setIsPro?.(newValue)
      if (newValue) localStorage.setItem('force_pro', 'true')
      else localStorage.removeItem('force_pro')
      showToast?.(newValue ? 'Pro activated (dev)' : 'Pro deactivated (dev)', 'success')
    } catch (e) {
      showToast?.(e?.message || 'Failed to update', 'error')
    } finally {
      setBillingMsg('')
      setBillingBusy(false)
    }
  }

  const reportProblemHref = useMemo(() => {
    const subject = encodeURIComponent('Paddock — report a problem')
    const body = encodeURIComponent(
      [
        `Describe what happened:`,
        ``,
        `---`,
        `User: ${username || 'unknown'}`,
        `Pro: ${isPro ? 'true' : 'false'}`,
        `Currency: ${currency}`,
        `Theme: dark`,
        `Browser: ${navigator.userAgent}`,
        ``,
      ].join('\n')
    )
    return `mailto:support@getpaddock.com?subject=${subject}&body=${body}`
  }, [username, isPro, currency])

  const inp =
  'w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.07] bg-black/[.02] dark:bg-white/[.045] text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all backdrop-blur'
  const lbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2'

  return (
    <div className="space-y-6">
      <div className="pb-1">
        <div className="text-sm font-semibold tracking-[.08em] uppercase text-ink-muted/40 dark:text-white/22">
          Settings
        </div>
        {!!username && (
          <div className="mt-0.5 text-[11px] text-ink-muted/45 dark:text-white/22">
            {username}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.08fr_0.92fr] gap-5">
      <div
  className="rounded-3xl p-6 sm:p-7"
  style={settingsPanelStyle}
>
          <div className="flex items-center gap-2 mb-5">
            <Globe size={14} className="text-ink-muted dark:text-white/35" />
            <h3 className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/40 dark:text-white/24">
              Preferences
            </h3>
          </div>

          <div>
            <label className={lbl}>Base currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inp}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c} — {CURRENCY_NAMES[c] || c}
                </option>
              ))}
            </select>
            <div className="mt-1.5 text-xs text-ink-muted/50 dark:text-white/25">
              All totals are shown in this currency.
            </div>

            <button
              onClick={saveCurrency}
              disabled={saving}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all disabled:opacity-50 min-h-[44px]"
              type="button"
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          <div className="mt-6 h-px bg-black/[.05] dark:bg-white/[.045]" />

          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={14} className="text-ink-muted dark:text-white/35" />
              <h4 className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/40 dark:text-white/24">
                Exchange rates
              </h4>
            </div>

            <p className="text-sm text-ink-muted dark:text-white/35 leading-relaxed mb-4">
              Cached daily. Falls back to approximate rates if APIs are unavailable.
            </p>

            <button
              onClick={refreshFx}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px]"
              type="button"
            >
              <RefreshCw size={14} /> Update rates
            </button>

            {fxStatus && (
              <div className="text-xs text-ink-muted dark:text-white/25 mt-3">
                {fxStatus}
              </div>
            )}
          </div>
        </div>

        <div
          className="relative rounded-3xl p-6 sm:p-7"
          style={settingsPanelStyle}
        >
          {isPro && (
            <div className="absolute top-[-10px] right-[-16px] w-28 h-28 opacity-[.018] pointer-events-none">
              <Crown size={112} className="text-accent" />
            </div>
          )}

          <div className="flex items-center gap-2 mb-5">
            <Crown size={14} className={isPro ? 'text-accent' : 'text-ink-muted dark:text-white/35'} />
            <h3 className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/40 dark:text-white/24">
              Subscription
            </h3>
          </div>

          {isPro ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/[.03] dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.10]">
                  <Crown size={14} className="text-accent" />
                  <span className="text-sm font-semibold text-ink dark:text-white">
                    Pro
                  </span>
                </div>

                {!!subLabel && (
                  <span
                    className={[
                      'text-xs font-medium',
                      subStatus === 'past_due'
                        ? 'text-loss/80 dark:text-loss/70'
                        : 'text-ink-muted/60 dark:text-white/25',
                    ].join(' ')}
                  >
                    {subLabel}
                  </span>
                )}
              </div>

              <p className="text-sm text-ink-muted dark:text-white/40 leading-relaxed max-w-[34rem]">
                Manage billing, confirm your current status, and keep your subscription in good standing.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px] disabled:opacity-50"
                  onClick={openPortal}
                  disabled={billingBusy}
                  type="button"
                >
                  <CreditCard size={15} /> {billingBusy ? 'Opening…' : 'Manage billing'}
                </button>

                <button
                  onClick={refreshProStatus}
                  disabled={billingBusy}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px] disabled:opacity-50"
                  type="button"
                >
                  <RefreshCw size={15} /> Check status
                </button>
              </div>

              {!!billingMsg && (
                <div className="text-xs text-ink-muted/60 dark:text-white/25">
                  {billingMsg}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-ink-muted dark:text-white/45 leading-relaxed">
                Pro shows you the full picture — freedom timeline, real-terms projections, and what your money needs to do to get there.
              </p>

              <div className="rounded-2xl border border-black/[.06] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.04] px-4 py-4">
                <div className="text-sm font-semibold text-ink dark:text-white">
                  From £6/month
                </div>
                <div className="mt-1 text-xs text-ink-muted/55 dark:text-white/28">
                  Cancel anytime · Processed securely by Stripe
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <UpgradeButton
                  onClick={() => goUpgrade('settings_cta')}
                  disabled={billingBusy}
                  className="min-h-[48px]"
                >
                  Upgrade to Pro
                </UpgradeButton>

                <button
                  onClick={refreshProStatus}
                  disabled={billingBusy}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px] disabled:opacity-50"
                  type="button"
                >
                  <RefreshCw size={15} /> Check status
                </button>

                <button
                  onClick={() => goUpgrade('settings_view_plans')}
                  className="text-sm font-semibold text-ink-muted dark:text-white/45 hover:text-ink dark:hover:text-white transition-colors"
                  type="button"
                >
                  View plans
                </button>
              </div>

              {!!billingMsg ? (
                <div className="text-xs text-ink-muted/50 dark:text-white/25">
                  {billingMsg}
                </div>
              ) : (
                <div className="text-xs text-ink-muted/50 dark:text-white/25">
                  Encrypted checkout · Cancel anytime
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={utilityGridClass}>
      <div
  className="rounded-3xl p-6 sm:p-7"
  style={settingsPanelStyle}
>
          <div className="flex items-center gap-2 mb-3">
            <Mail size={14} className="text-ink-muted dark:text-white/35" />
            <h3 className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/40 dark:text-white/24">
              Support
            </h3>
          </div>

          <p className="text-sm text-ink-muted dark:text-white/40 leading-relaxed mb-4">
            Report a problem and include device details automatically so issues are easier to diagnose.
          </p>

          <a
            href={reportProblemHref}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px]"
          >
            <Mail size={14} /> Report a problem
          </a>
        </div>

        {isAdmin && (
          <div
          className="rounded-3xl p-6 sm:p-7"
          style={settingsPanelStyle}
        >
            <div className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/40 dark:text-white/24 mb-3">
              Admin
            </div>

            <p className="text-sm text-ink-muted dark:text-white/40 leading-relaxed mb-4">
              Open internal metrics for funnel, users, and upgrades.
            </p>

            <button
              onClick={() => setPage('admin')}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px]"
              type="button"
            >
              Open <ChevronRight size={15} />
            </button>
          </div>
        )}

        {IS_DEV && (
          <Card className="p-5 sm:p-6 border-dashed border-black/[.08] dark:border-white/[.08]">
            <div className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/40 dark:text-white/24 mb-3">
              Developer
            </div>

            <p className="text-sm text-ink-muted dark:text-white/40 leading-relaxed mb-4">
              Toggle Pro access for testing in development.
            </p>

            <button
              onClick={devTogglePro}
              disabled={billingBusy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all bg-black/[.03] dark:bg-white/[.06] text-ink dark:text-white border border-black/[.06] dark:border-white/[.10] hover:bg-black/[.05] dark:hover:bg-white/[.08] disabled:opacity-50 min-h-[44px]"
              type="button"
            >
              {billingBusy ? 'Updating…' : isPro ? 'Disable Pro' : 'Enable Pro'}
            </button>
          </Card>
        )}
      </div>
    </div>
  )
}