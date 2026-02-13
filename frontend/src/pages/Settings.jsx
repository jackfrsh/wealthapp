import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import { CURRENCIES } from '../utils'
import { Sun, Moon, Monitor, RefreshCw, Save, Globe } from 'lucide-react'

const CURRENCY_NAMES = {
  GBP: 'British Pound', USD: 'US Dollar', EUR: 'Euro', CHF: 'Swiss Franc',
  AUD: 'Australian Dollar', CAD: 'Canadian Dollar', JPY: 'Japanese Yen',
  SEK: 'Swedish Krona', NOK: 'Norwegian Krone', SGD: 'Singapore Dollar',
  NZD: 'New Zealand Dollar', HKD: 'Hong Kong Dollar', INR: 'Indian Rupee',
  BTC: 'Bitcoin', ETH: 'Ethereum',
}

const THEME_OPTIONS = [
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
]

export default function Settings() {
  const { dark, setDark, baseCurrency, setBaseCurrency, showToast, themePref, setThemePreference } = useApp()
  const [currency, setCurrency] = useState('GBP')
  const [goal, setGoal] = useState('')
  const [fxStatus, setFxStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const s = await api('/settings')
      setCurrency(s.base_currency || 'GBP')
      setGoal(s.goal ? String(s.goal) : '')
      setBaseCurrency(s.base_currency || 'GBP')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [setBaseCurrency])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await api('/settings', {
        method: 'PUT',
        body: {
          base_currency: currency,
          goal: Number(String(goal || '0').replace(/,/g, '')),
          theme_preference: themePref,
        },
      })
      setBaseCurrency(currency)
      showToast('Settings saved')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const refreshFx = async () => {
    setFxStatus('Refreshing...')
    try {
      const data = await api(`/fx/refresh?base=${currency}`, { method: 'POST' })
      const rates = data.rates || {}
      const sample = Object.entries(rates)
        .filter(([k]) => ['USD', 'EUR', 'GBP'].includes(k))
        .map(([k, v]) => `${k}: ${Number(v).toFixed(4)}`)
        .join('  ·  ')
      setFxStatus(`Updated ${data.date} · ${sample}`)
      showToast('FX rates refreshed')
    } catch (e) {
      setFxStatus(`Failed: ${e.message}`)
      showToast(e.message, 'error')
    }
  }

  const inp = "w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
  const lbl = "block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2"

  if (loading) return <div className="space-y-5"><div className="h-12 w-48 rounded-lg skeleton" /><div className="h-56 rounded-2xl skeleton" /></div>

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">Settings</h1>
        <p className="text-sm text-ink-muted dark:text-white/35 mt-1.5">Configure your wealth planner.</p>
      </div>

      {/* Appearance — 3-way toggle */}
      <Card className="p-7">
        <h3 className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35 mb-5 flex items-center gap-2">
          {dark ? <Moon size={14} /> : <Sun size={14} />} Appearance
        </h3>
        <div className="flex items-center gap-3">
          {THEME_OPTIONS.map(opt => {
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
              >
                <Icon size={17} /> {opt.label}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Currency & Goal */}
      <Card className="p-7">
        <h3 className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35 mb-5 flex items-center gap-2">
          <Globe size={14} /> Currency & Goal
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className={lbl}>Base currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={inp}>
              {CURRENCIES.map(c => (
                <option key={c} value={c}>{c} — {CURRENCY_NAMES[c] || c}</option>
              ))}
            </select>
            <div className="text-xs text-ink-muted/50 dark:text-white/25 mt-1.5">All totals shown in this currency.</div>
          </div>
          <div>
            <label className={lbl}>Wealth goal</label>
            <input value={goal} onChange={e => setGoal(e.target.value)} className={inp} placeholder="500000" inputMode="decimal" />
            <div className="text-xs text-ink-muted/50 dark:text-white/25 mt-1.5">Target net worth in base currency.</div>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all disabled:opacity-50 min-h-[48px]"
        >
          <Save size={15} /> {saving ? 'Saving...' : 'Save settings'}
        </button>
      </Card>

      {/* FX */}
      <Card className="p-7">
        <h3 className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35 mb-4">Exchange Rates</h3>
        <p className="text-sm text-ink-muted dark:text-white/35 mb-5 leading-relaxed">
          Rates are cached daily. If APIs are unavailable, approximate fallback rates are used.
        </p>
        <button
          onClick={refreshFx}
          className="flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors min-h-[48px]"
        >
          <RefreshCw size={15} /> Refresh FX rates
        </button>
        {fxStatus && <div className="text-xs text-ink-muted dark:text-white/25 mt-4">{fxStatus}</div>}
      </Card>
    </div>
  )
}
