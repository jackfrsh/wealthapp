import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import { CURRENCIES } from '../utils'
import { Sun, Moon, RefreshCw, Save, Globe } from 'lucide-react'

const CURRENCY_NAMES = {
  GBP: 'British Pound', USD: 'US Dollar', EUR: 'Euro', CHF: 'Swiss Franc',
  AUD: 'Australian Dollar', CAD: 'Canadian Dollar', JPY: 'Japanese Yen',
  SEK: 'Swedish Krona', NOK: 'Norwegian Krone', SGD: 'Singapore Dollar',
  NZD: 'New Zealand Dollar', HKD: 'Hong Kong Dollar', INR: 'Indian Rupee',
  BTC: 'Bitcoin', ETH: 'Ethereum',
}

export default function Settings() {
  const { dark, setDark, baseCurrency, setBaseCurrency, showToast } = useApp()
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
        body: { base_currency: currency, goal: Number(String(goal || '0').replace(/,/g, '')) },
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

  const inp = "w-full px-3.5 py-2.5 rounded-xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-sm text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
  const lbl = "block text-xs font-semibold text-ink-3 dark:text-white/60 mb-1.5"

  if (loading) return <div className="space-y-4"><div className="h-10 w-48 rounded-lg skeleton" /><div className="h-48 rounded-2xl skeleton" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">Settings</h1>
        <p className="text-sm text-ink-muted dark:text-white/40 mt-1">Configure your wealth tracker.</p>
      </div>

      {/* Appearance */}
      <Card className="p-6">
        <h3 className="text-[10px] font-bold tracking-[.1em] uppercase text-ink-muted dark:text-white/40 mb-4 flex items-center gap-1.5">
          {dark ? <Moon size={12} /> : <Sun size={12} />} Appearance
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDark(false)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
              !dark ? 'border-accent bg-accent/5 text-ink' : 'border-transparent bg-surface-2 dark:bg-white/5 text-ink-muted dark:text-white/40 hover:border-black/10 dark:hover:border-white/10'
            }`}
          >
            <Sun size={16} /> Light
          </button>
          <button
            onClick={() => setDark(true)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
              dark ? 'border-accent bg-accent/5 dark:bg-accent/10 text-white' : 'border-transparent bg-surface-2 dark:bg-white/5 text-ink-muted dark:text-white/40 hover:border-black/10 dark:hover:border-white/10'
            }`}
          >
            <Moon size={16} /> Dark
          </button>
        </div>
      </Card>

      {/* Currency & Goal */}
      <Card className="p-6">
        <h3 className="text-[10px] font-bold tracking-[.1em] uppercase text-ink-muted dark:text-white/40 mb-4 flex items-center gap-1.5">
          <Globe size={12} /> Currency & Goal
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>Base currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={inp}>
              {CURRENCIES.map(c => (
                <option key={c} value={c}>{c} — {CURRENCY_NAMES[c] || c}</option>
              ))}
            </select>
            <div className="text-[10px] text-ink-muted dark:text-white/30 mt-1">All totals shown in this currency.</div>
          </div>
          <div>
            <label className={lbl}>Wealth goal</label>
            <input value={goal} onChange={e => setGoal(e.target.value)} className={inp} placeholder="500000" inputMode="decimal" />
            <div className="text-[10px] text-ink-muted dark:text-white/30 mt-1">Target net worth in base currency.</div>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-ink dark:bg-white text-white dark:text-ink hover:opacity-90 transition-all disabled:opacity-50"
        >
          <Save size={14} /> {saving ? 'Saving...' : 'Save settings'}
        </button>
      </Card>

      {/* FX */}
      <Card className="p-6">
        <h3 className="text-[10px] font-bold tracking-[.1em] uppercase text-ink-muted dark:text-white/40 mb-3">Exchange Rates</h3>
        <p className="text-sm text-ink-muted dark:text-white/40 mb-4">
          Rates are cached daily. If APIs are unavailable, approximate fallback rates are used.
        </p>
        <button
          onClick={refreshFx}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
        >
          <RefreshCw size={14} /> Refresh FX rates
        </button>
        {fxStatus && <div className="text-xs text-ink-muted dark:text-white/30 mt-3">{fxStatus}</div>}
      </Card>
    </div>
  )
}
