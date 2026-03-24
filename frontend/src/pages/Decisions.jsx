// frontend/src/pages/Decisions.jsx
// Final refinement pass.
// Copy tightened throughout. Scene 3 footer shortened.
// "likely the cleanest" → "the cleanest". Priority row 3 more specific.
// All logic, calculations, ISA persistence, and hook usage: unchanged.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../App'
import { ImpactNumber, ToolWorkbench } from '../components/surfaces'
import { track } from '../track'
import PlanIsaStrategyCard from '../components/outlook/PlanIsaStrategyCard'
import WhatIfCard from './WhatIfCard'
import useOutlookForecast from '../hooks/outlook/useOutlookForecast'
import { isIsaUrgent } from '../utils'
import {
  AlertTriangle, RefreshCw, Landmark, CircleDollarSign,
  Shield, ArrowRight, ChevronRight, Sparkles,
} from 'lucide-react'

/* ── Pure helpers (unchanged) ──────────────────────── */

function numFrom(input, fallback = 0) {
  const n = Number(String(input ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function getIsaStorageKey(goalId) {
  const now = new Date()
  const year = now.getFullYear(), month = now.getMonth(), day = now.getDate()
  const startYear = month > 3 || (month === 3 && day >= 6) ? year : year - 1
  return `paddock:plan:isa:${goalId || 'default'}:${startYear}`
}

function formatCurrency(value, currency = 'GBP', digits = 0) {
  const n = Number(value || 0)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(n)
  } catch { return `${currency} ${n.toLocaleString()}` }
}

function formatCompactCurrency(value, currency = 'GBP') {
  const n = Number(value || 0)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n)
  } catch { return `${currency} ${Math.round(n).toLocaleString()}` }
}

function formatPercent(value, digits = 1) { return `${Number(value || 0).toFixed(digits)}%` }

function getCurrentTaxYearLabel() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const startYear = m > 3 || (m === 3 && d >= 6) ? y : y - 1
  return `${startYear}/${String(startYear + 1).slice(-2)}`
}

function getTaxYearEndLabel() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const endYear = m > 3 || (m === 3 && d >= 6) ? y + 1 : y
  return `5 April ${endYear}`
}

function daysUntilTaxYearEnd() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const endYear = m > 3 || (m === 3 && d >= 6) ? y + 1 : y
  const end = new Date(endYear, 3, 5, 23, 59, 59)
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

function monthsUntilTaxYearEnd() { return Math.max(1, Math.ceil(daysUntilTaxYearEnd() / 30.4)) }

function monthlyMortgagePayment(principal, annualRatePct, termYears) {
  const P = Math.max(0, Number(principal || 0))
  const r = Math.max(0, Number(annualRatePct || 0)) / 100 / 12
  const n = Math.max(1, Math.round(Number(termYears || 0) * 12))
  if (P <= 0) return 0
  if (r === 0) return P / n
  return (P * r) / (1 - Math.pow(1 + r, -n))
}

function simulateMortgage({ balance, annualRatePct, monthlyPayment, monthlyOverpayment = 0, lumpSum = 0 }) {
  let remaining = Math.max(0, Number(balance || 0) - Math.max(0, Number(lumpSum || 0)))
  const monthlyRate = Math.max(0, Number(annualRatePct || 0)) / 100 / 12
  const payment = Math.max(0, Number(monthlyPayment || 0)) + Math.max(0, Number(monthlyOverpayment || 0))
  if (remaining <= 0) return { months: 0, totalInterest: 0, totalPaid: 0 }
  if (payment <= 0) return { months: Infinity, totalInterest: Infinity, totalPaid: Infinity }
  let months = 0, totalInterest = 0, totalPaid = 0
  const maxMonths = 12 * 100
  while (remaining > 0.01 && months < maxMonths) {
    const interest = remaining * monthlyRate
    let pp = payment - interest
    if (pp <= 0) return { months: Infinity, totalInterest: Infinity, totalPaid: Infinity }
    if (pp > remaining) pp = remaining
    remaining -= pp; totalInterest += interest; totalPaid += pp + interest; months++
  }
  if (months >= maxMonths) return { months: Infinity, totalInterest: Infinity, totalPaid: Infinity }
  return { months, totalInterest, totalPaid }
}

function futureValueMonthlyContribution({ startingAmount = 0, monthlyContribution = 0, annualRatePct = 0, years = 0 }) {
  const P = Math.max(0, Number(startingAmount || 0))
  const C = Math.max(0, Number(monthlyContribution || 0))
  const r = Math.max(0, Number(annualRatePct || 0)) / 100 / 12
  const n = Math.max(0, Math.round(Number(years || 0) * 12))
  if (n === 0) return P
  if (r === 0) return P + C * n
  return P * Math.pow(1 + r, n) + C * ((Math.pow(1 + r, n) - 1) / r)
}

function yearsMonthsLabel(totalMonths) {
  if (!Number.isFinite(totalMonths)) return 'Not repayable at this payment'
  const years = Math.floor(totalMonths / 12), months = totalMonths % 12
  if (years <= 0) return `${months}m`
  if (months === 0) return `${years}y`
  return `${years}y ${months}m`
}

/* ── Lab input/result components ──────────────────── */

function LabField({ label, value, onChange, suffix }) {
  return (
    <label className="block">
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1.5"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      >
        {label}
      </div>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          className="w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none transition-all"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)', color: 'white' }}
        />
        {suffix && (
          <div
            className="absolute inset-y-0 right-4 flex items-center text-xs pointer-events-none"
            style={{ color: 'rgba(255,255,255,0.30)' }}
          >
            {suffix}
          </div>
        )}
      </div>
    </label>
  )
}

function LabInterpretation({ text }) {
  return (
    <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div
        className="text-[10px] font-semibold tracking-[.14em] uppercase mb-1.5"
        style={{ color: 'rgba(212,175,55,0.45)' }}
      >
        Reading
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>{text}</p>
    </div>
  )
}

/* ── Mortgage overpayment tool ──────────────────────── */

function MortgageOverpaymentTool({ baseCurrency, accounts = [] }) {
  const mortgageAccount = useMemo(() => (accounts || []).find(a => a.type === 'mortgage'), [accounts])
  const prefillRef = useRef(false)

  const [balance, setBalance] = useState('250000')
  const [rate, setRate] = useState('4.5')
  const [termYears, setTermYears] = useState('25')
  const [monthlyOverpayment, setMonthlyOverpayment] = useState('250')
  const [lumpSum, setLumpSum] = useState('0')

  useEffect(() => {
    if (prefillRef.current || !mortgageAccount) return
    prefillRef.current = true
    const bal = Number(mortgageAccount.balance || 0)
    const r = Number(mortgageAccount.annual_interest_rate_percent || 0)
    if (bal > 0) setBalance(String(Math.round(bal)))
    if (r > 0) setRate(String(r))
  }, [mortgageAccount])

  const pb = numFrom(balance), pr = numFrom(rate), pt = numFrom(termYears)
  const po = numFrom(monthlyOverpayment), pl = numFrom(lumpSum)
  const stdPmt = monthlyMortgagePayment(pb, pr, pt)
  const base = simulateMortgage({ balance: pb, annualRatePct: pr, monthlyPayment: stdPmt, monthlyOverpayment: 0, lumpSum: 0 })
  const over = simulateMortgage({ balance: pb, annualRatePct: pr, monthlyPayment: stdPmt, monthlyOverpayment: po, lumpSum: pl })
  const timeSaved = Number.isFinite(base.months) && Number.isFinite(over.months) ? Math.max(0, base.months - over.months) : 0
  const intSaved = Number.isFinite(base.totalInterest) && Number.isFinite(over.totalInterest) ? Math.max(0, base.totalInterest - over.totalInterest) : 0

  const reading = timeSaved > 0 && intSaved > 0
    ? `Overpaying gives a guaranteed return equal to your mortgage rate — strongest when your cash buffer is already healthy.`
    : `Overpaying gives a guaranteed return equal to your mortgage rate. Makes most sense when your rate is high and your emergency fund is solid.`

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <LabField label="Balance" value={balance} onChange={setBalance} />
        <LabField label="Interest rate" value={rate} onChange={setRate} suffix="%" />
        <LabField label="Term remaining" value={termYears} onChange={setTermYears} suffix="yrs" />
        <LabField label="Monthly overpayment" value={monthlyOverpayment} onChange={setMonthlyOverpayment} />
        <LabField label="Lump sum" value={lumpSum} onChange={setLumpSum} />
      </div>

      {prefillRef.current && mortgageAccount && (
        <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Balance and rate prefilled from {mortgageAccount.name}
        </div>
      )}

      {/* Dominant takeaway */}
      {timeSaved > 0 && intSaved > 0 ? (
        <div className="text-[15px] font-semibold text-white leading-snug">
          {po > 0 && pl > 0
            ? `Overpaying ${formatCurrency(po, baseCurrency)}/mo with a ${formatCurrency(pl, baseCurrency)} lump sum saves ${yearsMonthsLabel(timeSaved)} and ${formatCurrency(intSaved, baseCurrency)} in interest.`
            : po > 0
              ? `Overpaying ${formatCurrency(po, baseCurrency)}/mo saves ${yearsMonthsLabel(timeSaved)} and ${formatCurrency(intSaved, baseCurrency)} in interest.`
              : `A ${formatCurrency(pl, baseCurrency)} lump sum saves ${yearsMonthsLabel(timeSaved)} and ${formatCurrency(intSaved, baseCurrency)} in interest.`}
        </div>
      ) : (
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Adjust your overpayment to see the impact.
        </div>
      )}

      {/* Secondary metrics band */}
      <div className="rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {[
            { label: 'Standard payment', value: formatCurrency(stdPmt, baseCurrency) },
            { label: 'Original payoff', value: yearsMonthsLabel(base.months) },
            { label: 'New payoff', value: yearsMonthsLabel(over.months) },
            { label: 'Total paid', value: Number.isFinite(over.totalPaid) ? formatCurrency(over.totalPaid, baseCurrency) : '—' },
          ].map((cell, i) => (
            <div key={i} className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[.18em]" style={{ color: 'rgba(255,255,255,0.22)' }}>{cell.label}</div>
              <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-white">{cell.value}</div>
            </div>
          ))}
        </div>
      </div>

      <LabInterpretation text={reading} />
    </div>
  )
}

/* ── Mortgage vs savings tool ───────────────────────── */

function MortgageVsSavingsTool({ baseCurrency, accounts = [] }) {
  const mortgageAccount = useMemo(() => (accounts || []).find(a => a.type === 'mortgage'), [accounts])
  const prefillRef = useRef(false)

  const [cashAmount, setCashAmount] = useState('500')
  const [years, setYears] = useState('5')
  const [mortgageRate, setMortgageRate] = useState('4.5')
  const [savingsRate, setSavingsRate] = useState('4.0')
  const [investmentReturn, setInvestmentReturn] = useState('7.0')

  useEffect(() => {
    if (prefillRef.current || !mortgageAccount) return
    prefillRef.current = true
    const r = Number(mortgageAccount.annual_interest_rate_percent || 0)
    if (r > 0) setMortgageRate(String(r))
  }, [mortgageAccount])

  const amt = numFrom(cashAmount), hy = numFrom(years)
  const mr = numFrom(mortgageRate), sr = numFrom(savingsRate), ir = numFrom(investmentReturn)
  const contrib = amt * hy * 12
  const savFuture = futureValueMonthlyContribution({ monthlyContribution: amt, annualRatePct: sr, years: hy })
  const invFuture = futureValueMonthlyContribution({ monthlyContribution: amt, annualRatePct: ir, years: hy })
  const savGrowth = Math.max(0, savFuture - contrib)
  const invGrowth = Math.max(0, invFuture - contrib)
  const mortBenefit = contrib * (Math.pow(1 + mr / 100, hy) - 1)
  const best = [
    { k: 'mortgage', v: mortBenefit },
    { k: 'savings', v: savGrowth },
    { k: 'invest', v: invGrowth },
  ].sort((a, b) => b.v - a.v)[0]?.k

  const winnerLabel = best === 'mortgage' ? 'mortgage overpayment' : best === 'savings' ? 'saving' : 'investing'
  const winnerValue = best === 'mortgage' ? mortBenefit : best === 'savings' ? savGrowth : invGrowth
  const hasClearWinner = winnerValue > 0 && amt > 0

  const reading = best === 'mortgage'
    ? `Mortgage overpayment leads — a guaranteed ${formatPercent(mr)} return beats your savings rate here. Strongest when your cash buffer is already healthy.`
    : best === 'savings'
    ? `Cash saving leads. A savings rate above your mortgage rate makes it the cleaner choice over ${hy} years.`
    : `Investing leads on projected return over ${hy} years. Overpaying and saving offer certainty; investing wins if the assumed return holds.`

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <LabField label="Monthly amount" value={cashAmount} onChange={setCashAmount} />
        <LabField label="Time horizon" value={years} onChange={setYears} suffix="yrs" />
        <LabField label="Mortgage rate" value={mortgageRate} onChange={setMortgageRate} suffix="%" />
        <LabField label="Savings rate" value={savingsRate} onChange={setSavingsRate} suffix="%" />
        <LabField label="Projected return" value={investmentReturn} onChange={setInvestmentReturn} suffix="%" />
      </div>

      {prefillRef.current && mortgageAccount && (
        <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Mortgage rate prefilled from {mortgageAccount.name}
        </div>
      )}

      {/* Dominant takeaway */}
      {hasClearWinner ? (
        <div className="text-[15px] font-semibold text-white leading-snug">
          {formatCurrency(amt, baseCurrency)}/mo toward {winnerLabel} puts you {formatCurrency(winnerValue, baseCurrency)} ahead after {hy} years.
        </div>
      ) : (
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Enter an amount to compare options.
        </div>
      )}

      {/* Secondary metrics band */}
      <div className="rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {[
            { label: 'Total redirected', value: formatCurrency(contrib, baseCurrency) },
            { label: 'Mortgage benefit', value: formatCurrency(mortBenefit, baseCurrency) },
            { label: 'Savings growth', value: formatCurrency(savGrowth, baseCurrency) },
            { label: 'Investing growth', value: formatCurrency(invGrowth, baseCurrency) },
          ].map((cell, i) => (
            <div key={i} className="px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[.18em]" style={{ color: 'rgba(255,255,255,0.22)' }}>{cell.label}</div>
              <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-white">{cell.value}</div>
            </div>
          ))}
        </div>
      </div>

      <LabInterpretation text={reading} />
    </div>
  )
}

/* ── Main component ──────────────────────────────── */

export default function Decisions() {
  const {
    api, baseCurrency, setPage, primaryGoal, showToast,
    loadPrimaryGoal, bumpData, isPro, settingsReady,
  } = useApp()

  const trackedViewRef = useRef(false)
  const workbenchRef = useRef(null)
  const tabInitialisedRef = useRef(false)
  const [labOpen, setLabOpen] = useState(false)
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  const [isaUsedYtd, setIsaUsedYtd] = useState('')
  const [isaMonthly, setIsaMonthly] = useState('')
  const [activeTab, setActiveTab] = useState('isa')
  const [accounts, setAccounts] = useState([])
  const [usedTabs, setUsedTabs] = useState(new Set())

  const goalId = primaryGoal?.id
  const isaStorageKey = useMemo(() => getIsaStorageKey(goalId), [goalId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(isaStorageKey)
      if (!raw) { setIsaUsedYtd(''); setIsaMonthly(''); return }
      const parsed = JSON.parse(raw)
      setIsaUsedYtd(parsed.isaUsedYtd ?? '')
      setIsaMonthly(parsed.isaMonthly ?? '')
    } catch { setIsaUsedYtd(''); setIsaMonthly('') }
  }, [isaStorageKey])

  useEffect(() => {
    try { localStorage.setItem(isaStorageKey, JSON.stringify({ isaUsedYtd, isaMonthly })) } catch {}
  }, [isaStorageKey, isaUsedYtd, isaMonthly])

  const deflate = useCallback((value) => Number(value || 0), [])

  const { forecast, loading, error, localContrib, derived, retryForecast } = useOutlookForecast({
    goalId, primaryGoal, baseCurrency, settingsReady, isPro, deflate, numFrom,
    showToast, loadPrimaryGoal, bumpData, track,
  })

  useEffect(() => {
    if (trackedViewRef.current) return
    trackedViewRef.current = true
    track('page_view', { page: 'decisions' })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await api('/accounts')
        if (!cancelled) setAccounts(Array.isArray(rows) ? rows : [])
      } catch {
        if (!cancelled) setAccounts([])
      } finally {
        if (!cancelled) setAccountsLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const isaRemainingBackend = forecast?.isa_remaining ?? null
  const isaUrgent = isIsaUrgent(isaRemainingBackend)

  const hasMortgage = useMemo(
    () => (accounts || []).some((a) => a.type === 'mortgage' && Number(a.balance || 0) > 0),
    [accounts]
  )
  
  const getRecommendedTab = useCallback(() => {
    if (isaUrgent) return 'isa'
    if (hasMortgage) return 'mortgage-overpayment'
    if (status === 'adjust') return 'what-if'
    return 'isa'
  }, [isaUrgent, hasMortgage, status])
  
  const openDecisionLab = useCallback(() => {
    const nextTab = getRecommendedTab()
    setActiveTab(nextTab)
    setLabOpen(true)
  
    window.setTimeout(() => {
      workbenchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  
      window.setTimeout(() => {
        workbenchRef.current
          ?.querySelector('input, select, textarea, button')
          ?.focus()
      }, 420)
    }, 20)
  }, [getRecommendedTab])
  
  const closeDecisionLab = useCallback(() => {
    setLabOpen(false)
  }, [])

  useEffect(() => {
    if (tabInitialisedRef.current || !forecast || !accountsLoaded) return
    tabInitialisedRef.current = true
    setActiveTab(getRecommendedTab())
  }, [forecast, accountsLoaded, getRecommendedTab])

  const markTabUsed = useCallback((tabId) => {
    setUsedTabs((prev) => {
      if (prev.has(tabId)) return prev
      const next = new Set(prev)
      next.add(tabId)
      return next
    })
  }, [])

  /* ── Loading state ── */
  if (primaryGoal === undefined || loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-7 w-24 rounded-lg skeleton opacity-60" />
        <div className="-mx-4 sm:-mx-6 lg:-mx-8" style={{ background: '#141A26', minHeight: 320 }}>
          <div className="px-6 pt-9 pb-9 sm:px-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
            <div className="space-y-5">
              <div className="h-3 w-32 rounded skeleton opacity-20" />
              <div className="h-10 w-72 rounded-lg skeleton opacity-25" />
              <div className="h-4 w-full max-w-lg rounded skeleton opacity-15" />
            </div>
            <div className="space-y-3">
              <div className="h-3 w-24 rounded skeleton opacity-20" />
              <div className="h-14 w-44 rounded-lg skeleton opacity-25" />
            </div>
          </div>
        </div>
        <div className="h-[320px] rounded-3xl skeleton opacity-40" />
      </div>
    )
  }

  /* ── No goal state ── */
if (primaryGoal === null) {
  return (
    <div className="space-y-5 animate-page-in">
      <h1 className="text-sm font-semibold tracking-[.08em] uppercase text-ink-muted/40 dark:text-white/22">
        Decisions
      </h1>

      <div
        className="-mx-4 sm:-mx-6 lg:-mx-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0A0F1A 0%, #141A26 45%, #0F141F 100%)' }}
      >
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-14 w-[340px] h-[340px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 62%)' }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-16 -left-10 w-[240px] h-[240px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(120,169,230,0.05) 0%, transparent 62%)' }}
        />

        <div className="relative px-6 pt-9 pb-8 sm:px-10 sm:pt-10 sm:pb-9">
          <div className="max-w-[42rem]">
            <div
              className="text-[10px] font-semibold tracking-[.18em] uppercase mb-4"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              Decisions
            </div>

            <h2 className="text-[28px] sm:text-[34px] font-bold text-white tracking-tight leading-tight">
              Set a goal before you compare moves.
            </h2>

            <p
              className="mt-3 text-sm leading-relaxed max-w-[34rem]"
              style={{ color: 'rgba(255,255,255,0.42)' }}
            >
              Your target gives Decisions context — so Paddock can show whether the next pounds
              should go to ISA, mortgage, or your long-term plan.
            </p>

            <div className="mt-6">
              

            <button
  onClick={() => setPage('plan')}
  className="text-sm font-semibold px-6 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors"
  style={{ background: 'var(--gold)', color: '#0A0F1A' }}
                type="button"
>
  Set up goal in Plan
</button>
            </div>
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: Shield,
                  title: 'ISA guidance',
                  body: 'See when wrappers should come first.',
                },
                {
                  icon: Landmark,
                  title: 'Mortgage trade-offs',
                  body: 'Model overpayments against other uses.',
                },
                {
                  icon: Sparkles,
                  title: 'Plan acceleration',
                  body: 'See what closes the gap faster.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl px-4 py-4"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={13} style={{ color: 'rgba(255,255,255,0.55)' }} />
                    <div className="text-[12.5px] font-semibold text-white">{title}</div>
                  </div>
                  <div className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

  /* ── Error state ── */
  if (error && !forecast) {
    return (
      <div className="space-y-5">
        <h1 className="text-sm font-semibold tracking-[.08em] uppercase text-ink-muted/40 dark:text-white/22">Decisions</h1>
        <div className="rounded-3xl border border-black/[.06] dark:border-white/[.07] bg-white dark:bg-surface-dark-2 p-8 text-center">
          <AlertTriangle size={28} className="text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-ink dark:text-white mb-1">Unable to load</p>
          <p className="text-xs text-ink-muted/50 dark:text-white/25 mb-5">{error}</p>
          <button
            onClick={retryForecast}
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors"
            type="button"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    )
  }

  /* ── Derived values (unchanged) ── */
  const goal = derived.goal
  const isaAllowance = 20000
  const isaUsed = Math.max(0, numFrom(isaUsedYtd, 0))
  const isaRemaining = Math.max(0, isaAllowance - isaUsed)
  const monthlyContribution = Math.max(0, Number(localContrib || 0))
  const monthsLeft = monthsUntilTaxYearEnd()
  const daysLeft = daysUntilTaxYearEnd()
  const requiredToFillIsa = isaRemaining > 0 ? isaRemaining / monthsLeft : 0
  const taxYearLabel = getCurrentTaxYearLabel()
  const taxYearEnd = getTaxYearEndLabel()
  const goalTarget = Number(goal?.target_amount || 0)
  const goalName = goal?.name || ''
  const goalCurrent = derived.currentNW
  const goalGap = Math.max(0, goalTarget - goalCurrent)

  const MILESTONE_LADDER = [1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000]
  const milestoneTarget = MILESTONE_LADDER.find((x) => x > goalCurrent) || 0

  const primaryRec = isaUrgent
    ? 'Use this tax year deliberately.'
    : status === 'adjust'
      ? 'Close the gap to your target.'
      : 'Model your next move.'

  const primaryBody = isaUrgent
    ? `${formatCurrency(isaRemaining, baseCurrency)} of ISA room before ${taxYearEnd}. Directing new money into wrappers first is the cleanest next move.`
    : status === 'adjust'
      ? 'Your current pace leaves a gap. Modelling contributions and trade-offs is the clearest next step.'
      : 'Use the lab below to model mortgage trade-offs, ISA strategy, or contribution pace before committing.'

  const priorities = [
    {
      label: 'Use remaining ISA room first',
      value: isaRemaining > 0 ? formatCompactCurrency(isaRemaining, baseCurrency) : 'Largely used',
      body: isaRemaining > 0
        ? `${formatCurrency(isaRemaining, baseCurrency)} available this year. Tax-free growth is one of the clearest upgrades available before ${taxYearEnd}.`
        : 'ISA capacity is largely used. Other decisions now matter more.',
    },
    {
      label: 'Close the gap to your target',
      value: goalGap > 0 ? formatCompactCurrency(goalGap, baseCurrency) : 'On track',
      body: goalGap > 0
        ? `${formatCompactCurrency(goalGap, baseCurrency)} to your stated target. Contribution pace and wrapper choice both matter.`
        : 'At or beyond your target. Focus shifts to protecting flexibility.',
    },
  ]

  const TABS = [
    { id: 'isa',                  label: 'ISA strategy',         icon: Shield },
    { id: 'mortgage-overpayment', label: 'Mortgage overpayment', icon: Landmark },
    { id: 'mortgage-vs-savings',  label: 'Where next pounds go', icon: CircleDollarSign },
    { id: 'what-if',              label: 'Accelerate your plan', icon: Sparkles },
  ]

  return (
    <div className="space-y-5">

      <h1 className="text-sm font-semibold tracking-[.08em] uppercase text-ink-muted/40 dark:text-white/22">Decisions</h1>

      {error && forecast && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle size={15} />
          <span>May be outdated. <button onClick={retryForecast} className="underline font-medium" type="button">Retry</button></span>
        </div>
      )}

      {/* ══════ SCENE 1: RECOMMENDATION STAGE ══════ */}
      <div
        className="-mx-4 sm:-mx-6 lg:-mx-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0A0F1A 0%, #141A26 45%, #0F141F 100%)' }}
      >
        <div
          aria-hidden="true"
          className="absolute -top-28 -right-16 w-[440px] h-[440px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 60%)' }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-20 -left-12 w-[360px] h-[360px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(120,169,230,0.06) 0%, transparent 60%)' }}
        />

        <div className="relative px-6 pt-9 pb-9 sm:px-10 sm:pt-11">
          {/* Eyebrow — ISA urgency only */}
          {isaUrgent && (
            <div
              className="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[.18em] uppercase mb-7"
              style={{ color: 'var(--gold)', opacity: 0.65 }}
            >
              Tax year {taxYearLabel} · {daysLeft} days remaining
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-14 items-start">

            {/* Left: recommendation */}
            <div className="min-w-0">
              <div
                className="text-[10px] font-semibold tracking-[.18em] uppercase mb-4"
                style={{ color: 'rgba(255,255,255,0.28)' }}
              >
                Primary recommendation
              </div>
              <h2 className="text-[26px] sm:text-[32px] lg:text-[36px] font-bold text-white leading-tight tracking-tight">
                {primaryRec}
              </h2>
              <p className="mt-4 text-sm leading-relaxed max-w-[46rem]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {primaryBody}
              </p>

              {/* Priority rows */}
              <div className="mt-8 space-y-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                {priorities.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 py-4"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 text-[10px] font-bold"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}
                    >
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-white leading-snug">{item.label}</div>
                      <div className="mt-0.5 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {item.body}
                      </div>
                    </div>
                    {item.value && (
                      <div
                        className="shrink-0 text-sm font-semibold tabular-nums"
                        style={{ color: i === 0 && isaRemaining > 0 ? 'var(--gold)' : 'rgba(255,255,255,0.55)' }}
                      >
                        {item.value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: ISA impact number */}
            <div className="shrink-0 lg:min-w-[200px] lg:text-right">
              <div
                className="text-[10px] font-semibold tracking-[.18em] uppercase mb-3"
                style={{ color: 'rgba(255,255,255,0.28)' }}
              >
                ISA room remaining
              </div>
              <ImpactNumber
                value={formatCompactCurrency(isaRemaining, baseCurrency)}
                label={`before ${taxYearEnd}`}
                positive={isaRemaining > 0}
              />
              <div className="mt-6 space-y-4">
                <div>
                  <div
                    className="text-[10px] font-semibold tracking-[.14em] uppercase mb-1"
                    style={{ color: 'rgba(255,255,255,0.22)' }}
                  >
                    Current pace
                  </div>
                  <div className="text-lg font-bold text-white tabular-nums">
                    {formatCurrency(monthlyContribution, baseCurrency)}/mo
                  </div>
                </div>
                {requiredToFillIsa > 0 && (
                  <div>
                    <div
                      className="text-[10px] font-semibold tracking-[.14em] uppercase mb-1"
                      style={{ color: 'rgba(255,255,255,0.22)' }}
                    >
                      To fill allowance
                    </div>
                    <div className="text-lg font-bold text-white tabular-nums">
                      {formatCurrency(requiredToFillIsa, baseCurrency)}/mo
                    </div>
                    <div className="mt-0.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      even pace to {taxYearEnd}
                    </div>
                  </div>
                )}
                <div>
                  <div
                    className="text-[10px] font-semibold tracking-[.14em] uppercase mb-1"
                    style={{ color: 'rgba(255,255,255,0.22)' }}
                  >
                    Months left
                  </div>
                  <div className="text-lg font-bold text-white tabular-nums">{monthsLeft}</div>
                </div>
              </div>
              <button
  type="button"
  onClick={openDecisionLab}
  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-2xl transition-opacity hover:opacity-80"
  style={{ background: 'var(--gold)', color: '#0A0F1A' }}
>
  Open decision lab <ChevronRight size={14} />
</button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ SCENE 2: DECISION LAB ══════ */}
<div
  ref={workbenchRef}
  className="relative overflow-hidden rounded-3xl"
  style={{
    background: 'linear-gradient(160deg, #1E2535 0%, #141A26 100%)',
    border: '1px solid rgba(255,255,255,0.07)',
    boxShadow: '0 4px 32px rgba(0,0,0,0.32)',
  }}
>
  <div
    aria-hidden="true"
    className="absolute -top-20 -right-10 w-[280px] h-[280px] rounded-full pointer-events-none"
    style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 65%)' }}
  />

<div
  className={`relative px-7 pt-7 pb-7 sm:px-9 ${!labOpen ? 'cursor-pointer' : ''}`}
  onClick={!labOpen ? openDecisionLab : undefined}
>
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div
          className="text-[10px] font-semibold tracking-[.18em] uppercase mb-2"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Decision lab
        </div>
        <h3 className="text-[20px] sm:text-[22px] font-semibold text-white tracking-tight">
          Model before you move.
        </h3>
        <p className="mt-2 text-sm leading-relaxed max-w-[42rem]" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {labOpen
            ? 'Use the tool below to test the most relevant next move before committing.'
            : 'Start with the recommendation above, then open the lab when you want to test the numbers.'}
        </p>
      </div>

      {labOpen ? (
  <button
    type="button"
    onClick={closeDecisionLab}
    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
    style={{
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.09)',
      color: 'rgba(255,255,255,0.42)',
    }}
  >
    Hide lab
  </button>
) : null}
    </div>
  </div>

  {labOpen && (
    <>
      <div className="relative px-7 pt-0 pb-0 sm:px-9">
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={activeTab === id
                ? { background: 'rgba(120,169,230,0.28)', border: '1px solid rgba(120,169,230,0.42)', color: 'rgba(243,245,247,0.92)' }
                : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.40)' }}
            >
              <Icon size={13} style={{ opacity: 0.75 }} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative px-7 pt-7 pb-8 sm:px-9"
        onPointerDown={() => markTabUsed(activeTab)}
      >
        <div style={activeTab === 'isa' ? undefined : { display: 'none' }} aria-hidden={activeTab !== 'isa'} inert={activeTab !== 'isa' ? '' : undefined}>
          <ToolWorkbench title="ISA strategy" proOnly={false} isPro={isPro}>
            <PlanIsaStrategyCard
              goal={goal}
              derived={derived}
              status={status}
              localContrib={localContrib}
              isaUsedYtd={isaUsedYtd}
              setIsaUsedYtd={setIsaUsedYtd}
              isaMonthly={isaMonthly}
              setIsaMonthly={setIsaMonthly}
              track={track}
            />
          </ToolWorkbench>
        </div>

        <div style={activeTab === 'mortgage-overpayment' ? undefined : { display: 'none' }} aria-hidden={activeTab !== 'mortgage-overpayment'} inert={activeTab !== 'mortgage-overpayment' ? '' : undefined}>
          <ToolWorkbench title="Mortgage overpayment" proOnly={false} isPro={isPro}>
            <MortgageOverpaymentTool baseCurrency={baseCurrency} accounts={accounts} />
          </ToolWorkbench>
        </div>

        <div style={activeTab === 'mortgage-vs-savings' ? undefined : { display: 'none' }} aria-hidden={activeTab !== 'mortgage-vs-savings'} inert={activeTab !== 'mortgage-vs-savings' ? '' : undefined}>
          <ToolWorkbench title="Where next pounds go" proOnly={false} isPro={isPro}>
            <MortgageVsSavingsTool baseCurrency={baseCurrency} accounts={accounts} />
          </ToolWorkbench>
        </div>

        <div style={activeTab === 'what-if' ? undefined : { display: 'none' }} aria-hidden={activeTab !== 'what-if'} inert={activeTab !== 'what-if' ? '' : undefined}>
          <ToolWorkbench title="Accelerate your plan" proOnly={false} isPro={isPro}>
            <WhatIfCard
              goalTarget={goalTarget}
              goalName={goalName}
              milestoneTarget={milestoneTarget}
              accounts={accounts}
              portfolioAnnualReturnPct={Number(forecast?.annual_return_pct || 7)}
              bare
            />
          </ToolWorkbench>
        </div>
      </div>
    </>
  )}
</div>
    </div>
  )
}