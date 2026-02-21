import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import UpgradeButton from '../components/UpgradeButton'
import { CURRENCIES } from '../utils'
import { Sun, Moon, Monitor, RefreshCw, Save, Globe, Crown, CreditCard } from 'lucide-react'

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

export default function Settings() {
  const { dark, baseCurrency, setBaseCurrency, showToast, themePref, setThemePreference, bumpData, isPro, setIsPro } =
    useApp()

  const [currency, setCurrency] = useState(baseCurrency || 'GBP')
  const [fxStatus, setFxStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingPro, setTogglingPro] = useState(false)

  const load = useCallback(async () => {
    try {
      const s = await api('/settings') // ✅ GET
      setCurrency(s?.base_currency || 'GBP')
      setBaseCurrency(s?.base_currency || 'GBP')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [setBaseCurrency])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await api('/settings', {
        method: 'PUT', // matches your FastAPI @router.put("")
        body: {
          base_currency: currency,
          theme_preference: themePref,
        },
      })
      setBaseCurrency(currency)
      bumpData()
      showToast('Settings saved')
    } catch (e) {
      showToast(e?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const togglePro = async () => {
    setTogglingPro(true)
    const newValue = !isPro
    try {
      await api('/settings', {
        method: 'PUT',
        body: { is_pro: newValue },
      })
      setIsPro(newValue)
      if (newValue) localStorage.setItem('force_pro', 'true')
      else localStorage.removeItem('force_pro')
      bumpData()
      showToast(newValue ? 'Pro activated' : 'Pro deactivated')
    } catch (e) {
      showToast(e?.message || 'Failed to update', 'error')
    } finally {
      setTogglingPro(false)
    }
  }

  const refreshFx = async () => {
    setFxStatus('Refreshing...')
    try {
      // Typically a GET endpoint; adjust to POST if your backend expects POST.
      const data = await api(`/fx/refresh?base=${currency}`)
      const rates = data?.rates || {}
      const sample = Object.entries(rates)
        .filter(([k]) => ['USD', 'EUR', 'GBP'].includes(k))
        .map(([k, v]) => `${k}: ${Number(v).toFixed(4)}`)
        .join('  ·  ')
      setFxStatus(`Updated ${data?.date || ''} · ${sample}`)
      showToast('FX rates refreshed')
    } catch (e) {
      setFxStatus(`Failed: ${e?.message || 'unknown error'}`)
      showToast(e?.message || 'Failed to refresh FX', 'error')
    }
  }

  const inp =
    'w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const lbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2'

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-12 w-48 rounded-lg skeleton" />
        <div className="h-56 rounded-2xl skeleton" />
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">Settings</h1>
        <p className="text-sm text-ink-muted dark:text-white/35 mt-1.5">Configure your wealth planner.</p>
      </div>

      {/* Subscription */}
      <Card className="p-7 overflow-hidden relative">
        {isPro && (
          <div className="absolute top-0 right-0 w-32 h-32 opacity-[.04] pointer-events-none">
            <Crown size={128} className="text-amber-500" />
          </div>
        )}

        <h3 className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35 mb-5 flex items-center gap-2">
          <Crown size={14} className={isPro ? 'text-amber-500' : ''} /> Subscription
        </h3>

        {isPro ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20">
                <Crown size={14} className="text-amber-500" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300 tracking-wide">Wealth Pro</span>
              </div>
              <span className="text-xs text-ink-muted/60 dark:text-white/25">Active</span>
            </div>

            <p className="text-sm text-ink-muted dark:text-white/45 leading-relaxed">
              You have full access to unlimited accounts, advanced projections, AI insights and priority features.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                className="inline-flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors min-h-[44px]"
                onClick={() => showToast('Stripe billing portal coming soon')}
                type="button"
              >
                <CreditCard size={15} /> Manage billing
              </button>

              <button
                onClick={togglePro}
                disabled={togglingPro}
                className="inline-flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl text-loss/80 hover:text-loss hover:bg-loss-light dark:hover:bg-loss/10 transition-colors min-h-[44px] disabled:opacity-50"
                type="button"
              >
                {togglingPro ? 'Updating…' : 'Cancel subscription'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted dark:text-white/45 leading-relaxed">
              Unlock unlimited accounts, advanced projections, AI insights and more.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <UpgradeButton onClick={togglePro} disabled={togglingPro} size="lg" className="min-h-[48px]">
                <Crown size={15} />
                {togglingPro ? 'Activating…' : 'Upgrade to Pro'}
              </UpgradeButton>

              <span className="text-xs text-ink-muted/50 dark:text-white/25">From £6/month · Cancel anytime</span>
            </div>
          </div>
        )}
      </Card>

      {/* Appearance */}
      <Card className="p-7">
        <h3 className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35 mb-5 flex items-center gap-2">
          {dark ? <Moon size={14} /> : <Sun size={14} />} Appearance
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = themePref === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => setThemePreference(opt.id)}
                className={`flex items-center gap-2.5 px-5 py-3.5 rounded-2xl border-2 transition-all text-sm font-medium min-h-[48px] ${
                  active
                    ? 'border-accent bg-accent/5 dark:bg-accent/10 text-ink dark:text-white'
                    : 'border-transparent bg-surface-2 dark:bg-white/5 text-ink-muted dark:text-white/35 hover:border-black/10 dark:hover:border-white/10'
                }`}
                type="button"
              >
                <Icon size={17} /> {opt.label}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Currency */}
      <Card className="p-7">
        <h3 className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35 mb-5 flex items-center gap-2">
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
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all disabled:opacity-50 min-h-[48px]"
          type="button"
        >
          <Save size={15} /> {saving ? 'Saving...' : 'Save settings'}
        </button>
      </Card>

      {/* FX */}
      <Card className="p-7">
        <h3 className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35 mb-4">
          Exchange Rates
        </h3>

        <p className="text-sm text-ink-muted dark:text-white/35 mb-5 leading-relaxed">
          Rates are cached daily. If APIs are unavailable, approximate fallback rates are used.
        </p>

        <button
          onClick={refreshFx}
          className="flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors min-h-[48px]"
          type="button"
        >
          <RefreshCw size={15} /> Refresh FX rates
        </button>

        {fxStatus && <div className="text-xs text-ink-muted dark:text-white/25 mt-4">{fxStatus}</div>}
      </Card>

      {/* Developer */}
      <Card className="p-7 border-dashed border-black/[.08] dark:border-white/[.08]">
        <h3 className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35 mb-4">
          Developer
        </h3>

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-ink dark:text-white">Pro Simulation</div>
            <div className="text-xs text-ink-muted dark:text-white/35 mt-1">Toggle Pro access for testing.</div>
          </div>

          {isPro ? (
            <button
              onClick={togglePro}
              disabled={togglingPro}
              className="px-4 py-2 rounded-2xl text-sm font-semibold transition-all bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/15 disabled:opacity-50"
              type="button"
            >
              {togglingPro ? '...' : 'Disable Pro'}
            </button>
          ) : (
            <UpgradeButton onClick={togglePro} disabled={togglingPro} size="sm">
              {togglingPro ? '...' : 'Enable Pro'}
            </UpgradeButton>
          )}
        </div>
      </Card>
    </div>
  )
}