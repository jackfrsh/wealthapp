// frontend/src/pages/Settings.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import UpgradeButton from '../components/UpgradeButton'
import { track } from '../track'
import { invalidateCache } from '../api'
import { CURRENCIES } from '../utils'
import {
  Sun,
  Moon,
  Monitor,
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

const THEME_OPTIONS = [
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
]

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
    dark,
    baseCurrency,
    setBaseCurrency,
    showToast,
    themePref,
    setThemePreference, // ✅ use ONLY this one from App.jsx
    isPro,
    setIsPro,
    refreshSettings,
    setPage,
    logout,
  } = useApp()

  const isDark = !!dark
  const [currency, setCurrency] = useState((baseCurrency || 'GBP').toUpperCase())

  // Always mirror current app currency (fast paint)
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

  // Persist theme to server (but App owns UI + localStorage + DOM)
const persistThemePreference = useCallback(
  async (pref) => {
    try {
      await api('/settings', { method: 'PUT', body: { theme_preference: pref } })
      invalidateCache()
    } catch (e) {
      console.warn('Theme save failed:', e)
      showToast?.('Could not save theme preference', 'error')
    }
  },
  [api, showToast]
)

  const saveCurrency = async () => {
    setSaving(true)
    try {
      await api('/settings', { method: 'PUT', body: { base_currency: currency } })
      setBaseCurrency?.(currency)
      showToast?.('Settings saved', 'success')
      // Only refresh if you rely on server to also return entitlement fields, etc.
      await refreshSettings?.({ force: true })
    } catch (e) {
      showToast?.(e?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const refreshFx = async () => {
    setFxStatus('Refreshing…')
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
    setBillingMsg('Refreshing subscription status…')
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
    const subject = encodeURIComponent('Wealth beta — report a problem')
    const body = encodeURIComponent(
      [
        `Describe what happened:`,
        ``,
        `---`,
        `User: ${username || 'unknown'}`,
        `Pro: ${isPro ? 'true' : 'false'}`,
        `Currency: ${currency}`,
        `Theme: ${themePref}`,
        `Browser: ${navigator.userAgent}`,
        ``,
      ].join('\n')
    )
    return `mailto:support@yourdomain.com?subject=${subject}&body=${body}`
  }, [username, isPro, currency, themePref])

  const inp =
    'w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white/70 dark:bg-white/5 text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all backdrop-blur'
  const lbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2'

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-ink-muted dark:text-white/35 mt-1.5">
            Configure your wealth planner.
          </p>
          {!!username && (
            <p className="text-xs text-ink-muted/60 dark:text-white/25 mt-1">
              Signed in as {username}
            </p>
          )}
        </div>

        <button
          onClick={logout}
          className="text-sm font-semibold px-4 py-2 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.04] dark:hover:bg-white/[.06] transition-colors"
          type="button"
        >
          Log out
        </button>
      </div>

      {/* Admin */}
      {isAdmin && (
        <Card className="p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold tracking-tightish text-ink-muted dark:text-white/35 mb-1">
                Admin
              </div>
              <div className="text-sm text-ink-muted dark:text-white/45">
                Funnel + users + upgrades
              </div>
            </div>
            <button
              onClick={() => setPage('admin')}
              className="inline-flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px]"
              type="button"
            >
              Open <ChevronRight size={16} />
            </button>
          </div>
        </Card>
      )}

      {/* Subscription */}
      <Card className="p-7 overflow-hidden relative">
        {isPro && (
          <div className="absolute top-0 right-0 w-32 h-32 opacity-[.035] pointer-events-none">
            <Crown size={128} className="text-accent" />
          </div>
        )}

        <h3 className="text-xs font-semibold tracking-tightish text-ink-muted dark:text-white/35 mb-5 flex items-center gap-2">
          <Crown size={14} className={isPro ? 'text-accent' : ''} /> Subscription
        </h3>

        {isPro ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/[.03] dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.10]">
                <Crown size={14} className="text-accent" />
                <span className="text-sm font-semibold text-ink dark:text-white tracking-tightish">
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

              {!!billingMsg && (
                <span className="text-xs text-ink-muted/60 dark:text-white/25">
                  · {billingMsg}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                className="inline-flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px] disabled:opacity-50"
                onClick={openPortal}
                disabled={billingBusy}
                type="button"
              >
                <CreditCard size={15} /> {billingBusy ? 'Opening…' : 'Manage billing'}
              </button>

              <button
                onClick={refreshProStatus}
                disabled={billingBusy}
                className="inline-flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px] disabled:opacity-50"
                type="button"
              >
                <RefreshCw size={15} /> Refresh status
              </button>

              <a
                href={reportProblemHref}
                className="inline-flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px]"
              >
                <Mail size={15} /> Report a problem
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted dark:text-white/45 leading-relaxed">
              Unlock unlimited accounts, advanced projections, inflation modelling, deeper insights and more.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <UpgradeButton
                onClick={() => {
                  track?.('upgrade_clicked', { source: 'settings_cta' })
                  try {
                    localStorage.setItem('upgrade_reason', 'settings_cta')
                  } catch {}
                  setPage('upgrade')
                }}
                disabled={billingBusy}
                className="min-h-[48px]"
              >
                Upgrade to Pro
              </UpgradeButton>

              <button
                onClick={() => {
                  try {
                    localStorage.setItem('upgrade_reason', 'settings_view_plans')
                  } catch {}
                  setPage('upgrade')
                }}
                className="text-sm font-semibold text-ink-muted dark:text-white/45 hover:text-ink dark:hover:text-white transition-colors"
                type="button"
              >
                View plans
              </button>

              {!!billingMsg ? (
                <span className="text-xs text-ink-muted/50 dark:text-white/25">{billingMsg}</span>
              ) : (
                <span className="text-xs text-ink-muted/50 dark:text-white/25">
                  From £6/month · Cancel anytime
                </span>
              )}
            </div>

            <div className="mt-3 text-xs text-ink-muted/60 dark:text-white/30">
              Encrypted checkout · Processed by Stripe · Cancel anytime
            </div>
          </div>
        )}
      </Card>

      {/* Appearance */}
      <Card className="p-7">
        <h3 className="text-xs font-semibold tracking-tightish text-ink-muted dark:text-white/35 mb-5 flex items-center gap-2">
          {isDark ? <Moon size={14} /> : <Sun size={14} />} Appearance
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = themePref === opt.id
            return (
              <button
                key={opt.id}
                onClick={async () => {
                  // Instant UX (App setter: state + DOM + localStorage)
                  setThemePreference(opt.id)
                  // Persist quietly (no extra GET)
                  await persistThemePreference(opt.id)
                }}
                className={[
                  'flex items-center gap-2.5 px-5 py-3.5 rounded-2xl border-2 transition-all text-sm font-medium min-h-[48px]',
                  active
                    ? 'border-accent bg-accent/5 dark:bg-accent/10 text-ink dark:text-white'
                    : 'border-transparent bg-black/[.03] dark:bg-white/[.05] text-ink-muted dark:text-white/35 hover:border-black/10 dark:hover:border-white/10',
                ].join(' ')}
                type="button"
              >
                <Icon size={17} /> {opt.label}
              </button>
            )
          })}
        </div>

        <div className="mt-3 text-xs text-ink-muted/55 dark:text-white/25">
          Changes apply instantly.
        </div>
      </Card>

      {/* Currency */}
      <Card className="p-7">
        <h3 className="text-xs font-semibold tracking-tightish text-ink-muted dark:text-white/35 mb-5 flex items-center gap-2">
          <Globe size={14} /> Currency
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={lbl}>Base currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inp}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c} — {CURRENCY_NAMES[c] || c}
                </option>
              ))}
            </select>
            <div className="text-xs text-ink-muted/50 dark:text-white/25 mt-1.5">
              All totals shown in this currency.
            </div>
          </div>
        </div>

        <button
          onClick={saveCurrency}
          disabled={saving}
          className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all disabled:opacity-50 min-h-[48px]"
          type="button"
        >
          <Save size={15} /> {saving ? 'Saving…' : 'Save settings'}
        </button>
      </Card>

      {/* FX */}
      <Card className="p-7">
        <h3 className="text-xs font-semibold tracking-tightish text-ink-muted dark:text-white/35 mb-4">
          Exchange Rates
        </h3>

        <p className="text-sm text-ink-muted dark:text-white/35 mb-5 leading-relaxed">
          Rates are cached daily. If APIs are unavailable, approximate fallback rates are used.
        </p>

        <button
          onClick={refreshFx}
          className="flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[48px]"
          type="button"
        >
          <RefreshCw size={15} /> Refresh FX rates
        </button>

        {fxStatus && <div className="text-xs text-ink-muted dark:text-white/25 mt-4">{fxStatus}</div>}
      </Card>

      {IS_DEV && (
        <Card className="p-7 border-dashed border-black/[.08] dark:border-white/[.08]">
          <h3 className="text-xs font-semibold tracking-tightish text-ink-muted dark:text-white/35 mb-4">
            Developer
          </h3>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-ink dark:text-white">Pro Simulation</div>
              <div className="text-xs text-ink-muted dark:text-white/35 mt-1">
                Toggle Pro access for testing (dev only).
              </div>
            </div>

            <button
              onClick={devTogglePro}
              disabled={billingBusy}
              className="px-4 py-2 rounded-2xl text-sm font-semibold transition-all bg-black/[.03] dark:bg-white/[.06] text-ink dark:text-white border border-black/[.06] dark:border-white/[.10] hover:bg-black/[.05] dark:hover:bg-white/[.08] disabled:opacity-50"
              type="button"
            >
              {billingBusy ? '…' : isPro ? 'Disable Pro' : 'Enable Pro'}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}