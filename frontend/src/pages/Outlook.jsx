// frontend/src/pages/Outlook.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { invalidatePath } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import UpgradeButton from '../components/UpgradeButton'
import { track } from '../track'
import { fmtCurrency, fmtCurrencyCompact } from '../utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts'

import WealthTooltip from '../components/charts/WealthTooltip'
import {
  xAxisProps,
  yAxisProps,
  gridProps,
  tooltipProps,
  compactTickFormatter,
  chartMargin,
  ACCENT_STROKE,
  activeDotStyle,
} from '../components/charts/chartTheme'

import {
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  RefreshCw,
  Pencil,
  X,
  Save,
  TrendingUp,
  Calendar,
  Crown,
  Lock,
} from 'lucide-react'

const FREE_HORIZON = 1
const INFLATION_RATE = 0.025

function numFrom(input, fallback = 0) {
  const n = Number(String(input ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

// Estimate required monthly contribution to reach fv from pv in N months at monthly rate r
function requiredMonthlyContribution({ pv, fv, yearsRemaining, annualReturnPct }) {
  const n = Math.max(0, Math.round((yearsRemaining || 0) * 12))
  if (!n) return null
  if (pv >= fv) return 0

  const er = Number(annualReturnPct || 0)
  const r = (er / 100) / 12
  if (!Number.isFinite(r)) return null

  if (r === 0) return Math.max(0, (fv - pv) / n)

  const pow = Math.pow(1 + r, n)
  const denom = (pow - 1) / r
  if (!Number.isFinite(denom) || denom === 0) return null

  const pmt = (fv - pv * pow) / denom
  return Math.max(0, pmt)
}

export default function Outlook() {
  const {
    baseCurrency,
    setPage,
    primaryGoal,
    showToast,
    loadPrimaryGoal,
    bumpData,
    isPro,
    settingsReady,
  } = useApp()

  // ─── Strategy state ─────────────────────────────────────
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [localContrib, setLocalContrib] = useState('')
  const [localReturn, setLocalReturn] = useState('')
  const [dirty, setDirty] = useState(false)

  // Pro: lightweight "what-if" peek (+£100/+£250)
  const [whatIf, setWhatIf] = useState(null)
  const whatIfTimer = useRef(null)

  // Refs for stable callbacks
  const forecastRef = useRef(null)
  const justAppliedRef = useRef(false)
  const lastWhatIfKeyRef = useRef('')

  const [feedback, setFeedback] = useState(null)
  const feedbackTimer = useRef(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    name: 'Retirement',
    current_age: '',
    target_age: '60',
    target_amount: '',
    expected_annual_return_pct: '7',
    monthly_contribution: '0',
  })

  // ─── Projections state ──────────────────────────────────
  const [projOpen, setProjOpen] = useState(false)
  const [trajOpen, setTrajOpen] = useState(true)
  const [projData, setProjData] = useState(null)
  const [projHistory, setProjHistory] = useState([])
  const [projYears, setProjYears] = useState(25)
  const [projLoading, setProjLoading] = useState(false)
  const [forecastVersion, setForecastVersion] = useState(0)

  // ─── Inflation adjustment ───────────────────────────────
  const [inflationAdj, setInflationAdj] = useState(false)

  const deflate = useCallback(
    (value, yearsFromNow) => {
      if (!settingsReady) return value
      if (!inflationAdj || !isPro) return value
      return Number(value || 0) / Math.pow(1 + INFLATION_RATE, Number(yearsFromNow || 0))
    },
    [settingsReady, inflationAdj, isPro]
  )

  const HORIZONS = settingsReady && isPro ? [1, 5, 10, 15, 20, 25, 30, 40] : [1]
  const effectiveProjYears = settingsReady && isPro ? projYears : FREE_HORIZON
  const goalId = primaryGoal?.id

  // ────────────────────────────────────────────────────────
  // Forecast fetch (base) + read-only fetch (what-if)
  // ────────────────────────────────────────────────────────

  const fetchForecast = useCallback(
    async (mc, er) => {
      if (!goalId) return null
      let url = `/goals/${goalId}/forecast`
      const params = []
      if (mc !== undefined && mc !== '') params.push(`monthly_contribution=${encodeURIComponent(mc)}`)
      if (er !== undefined && er !== '') params.push(`expected_return=${encodeURIComponent(er)}`)
      if (params.length) url += `?${params.join('&')}`
      return await api(url)
    },
    [goalId]
  )

  const lastForecastKeyRef = useRef('')
  const inflightForecastRef = useRef(new Map())

  const loadForecast = useCallback(
    async (mc, er, { force = false } = {}) => {
      if (!goalId) return null

      const mcKey = mc === undefined || mc === '' ? '' : String(mc)
      const erKey = er === undefined || er === '' ? '' : String(er)
      const key = `${goalId}|${mcKey}|${erKey}`

      if (!force && lastForecastKeyRef.current === key && forecastRef.current) {
        return forecastRef.current
      }

      if (!force && inflightForecastRef.current.has(key)) {
        return await inflightForecastRef.current.get(key)
      }

      setError(null)

      const p = (async () => {
        const d = await fetchForecast(mc, er)
        lastForecastKeyRef.current = key
        forecastRef.current = d
        setForecast(d)
        setForecastVersion((v) => v + 1)
        return d
      })()

      inflightForecastRef.current.set(key, p)
      try {
        return await p
      } catch (e) {
        console.error('Outlook forecast error:', e)
        setError(e?.message || 'Failed to load forecast')
        return null
      } finally {
        inflightForecastRef.current.delete(key)
      }
    },
    [goalId, fetchForecast]
  )

  // Pro-only: read-only what-if (does NOT touch baseline forecast)
  const loadWhatIf = useCallback(
    async (mc, er) => {
      if (!goalId) return
      if (!settingsReady || !isPro) return

      const baseMc = numFrom(mc, 0)
      const baseEr = numFrom(er, 0)
      if (!Number.isFinite(baseEr) || baseEr <= 0) {
        setWhatIf(null)
        return
      }

      try {
        const mc100 = baseMc + 100
        const mc250 = baseMc + 250

        const [plus100, plus250] = await Promise.all([
          fetchForecast(mc100, baseEr),
          fetchForecast(mc250, baseEr),
        ])

        setWhatIf(plus100 && plus250 ? { plus100, plus250 } : null)
      } catch {
        setWhatIf(null)
      }
    },
    [goalId, settingsReady, isPro, fetchForecast]
  )

  // ─── SELF-HEAL once ─────────────────────────────────────
  const goalHealAttemptedRef = useRef(false)
  useEffect(() => {
    if (!settingsReady) return
    if (primaryGoal !== undefined) return
    if (goalHealAttemptedRef.current) return
    goalHealAttemptedRef.current = true
    loadPrimaryGoal?.()
  }, [settingsReady, primaryGoal, loadPrimaryGoal])

  // Seed inputs + load forecast when primary goal loads/changes
  useEffect(() => {
    if (primaryGoal === undefined) return

    if (justAppliedRef.current) {
      justAppliedRef.current = false
      return
    }

    let cancelled = false

    ;(async () => {
      if (!primaryGoal) {
        forecastRef.current = null
        setForecast(null)
        setWhatIf(null)
        setLoading(false)
        return
      }

      const seededMc = String(primaryGoal.monthly_contribution ?? 0)
      const seededEr = String(primaryGoal.expected_annual_return_pct ?? 7)

      setLocalContrib(seededMc)
      setLocalReturn(seededEr)

      setEditForm({
        name: primaryGoal.name || 'Retirement',
        current_age: String(primaryGoal.current_age ?? ''),
        target_age: String(primaryGoal.target_age ?? '60'),
        target_amount: String(primaryGoal.target_amount ?? ''),
        expected_annual_return_pct: String(primaryGoal.expected_annual_return_pct ?? 7),
        monthly_contribution: String(primaryGoal.monthly_contribution ?? 0),
      })

      setLoading(true)
      try {
        await loadForecast(seededMc, seededEr)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })().catch((e) => {
      console.error('Seed forecast load failed:', e)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryGoal, goalId, loadForecast])

  // Debounce what-if peeks while typing (Pro only) — SINGLE effect
  useEffect(() => {
    if (!settingsReady || !isPro) return
    if (!goalId) return
    if (!forecastVersion) return // only after baseline loaded at least once

    const key = `${goalId}|${localContrib}|${localReturn}`
    if (lastWhatIfKeyRef.current === key) return
    lastWhatIfKeyRef.current = key

    if (whatIfTimer.current) clearTimeout(whatIfTimer.current)
    whatIfTimer.current = setTimeout(() => {
      loadWhatIf(localContrib, localReturn)
    }, 450)

    return () => {
      if (whatIfTimer.current) clearTimeout(whatIfTimer.current)
    }
  }, [settingsReady, isPro, goalId, localContrib, localReturn, loadWhatIf, forecastVersion])

  // ─── Projections loader ─────────────────────────────────
  const loadProjections = useCallback(
    async (years) => {
      const horizon = years ?? FREE_HORIZON
      setProjLoading(true)

      try {
        const days = Math.max(365, Math.round(horizon * 365))
        const [proj, hist] = await Promise.all([
          api(`/projection/networth?years=${horizon}`),
          api(`/history/networth?days=${days}`),
        ])
        setProjData(proj)
        setProjHistory(hist.points || [])
      } catch (e) {
        console.error('Projections load error:', e)
      } finally {
        setProjLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!settingsReady) return
    if (isPro) setProjYears((prev) => (prev && prev !== FREE_HORIZON ? prev : 25))
    else setProjYears((prev) => prev || 25)
  }, [settingsReady, isPro])

  useEffect(() => {
    if (!projOpen) return
    if (!settingsReady) return
    loadProjections(effectiveProjYears)
  }, [projOpen, settingsReady, effectiveProjYears, loadProjections])

  useEffect(() => {
    track?.('projection_opened')
  }, [])

  // ─── UI helpers ─────────────────────────────────────────
  const showFeedback = (msg) => {
    setFeedback(msg)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2600)
  }

  const retryForecast = () => {
    setLoading(true)
    setError(null)
    loadForecast(localContrib, localReturn)
  }

  const applyAssumptions = useCallback(
    async ({ mcOverride = null, erOverride = null } = {}) => {
      if (!goalId) return

      const mc = mcOverride != null ? mcOverride : numFrom(localContrib, 0)
      const er = erOverride != null ? erOverride : numFrom(localReturn, 0)
      const prevStatus = forecast?.status

      setLoading(true)
      setError(null)

      try {
        await api(`/goals/${goalId}`, {
          method: 'PATCH',
          body: {
            monthly_contribution: mc,
            expected_annual_return_pct: er,
          },
        })

        setDirty(false)

        // Targeted invalidation (no storms)
        invalidatePath('/goals/primary', `/goals/${goalId}/forecast`)

        // Fetch updated baseline forecast ONCE
        const newForecast = await loadForecast(mc, er, { force: true })

        if (
          newForecast &&
          (newForecast.status === 'on_track' || newForecast.status === 'ahead') &&
          prevStatus === 'adjust'
        ) {
          showFeedback("You're now on track.")
        } else {
          showFeedback('Updated')
        }

        // Background refresh (safe)
        justAppliedRef.current = true
        Promise.resolve()
          .then(async () => {
            await loadPrimaryGoal?.()
            bumpData?.()
          })
          .catch(() => {})
      } catch (e) {
        console.error(e)
        showToast(e?.message || String(e), 'error')
      } finally {
        setLoading(false)
      }
    },
    [goalId, localContrib, localReturn, forecast?.status, loadForecast, loadPrimaryGoal, bumpData, showToast]
  )

  const openEdit = () => {
    const g = forecast?.goal || primaryGoal
    if (!g) return
    setEditForm({
      name: g.name || 'Retirement',
      current_age: String(g.current_age ?? ''),
      target_age: String(g.target_age ?? '60'),
      target_amount: String(g.target_amount ?? ''),
      expected_annual_return_pct: String(g.expected_annual_return_pct ?? 7),
      monthly_contribution: String(g.monthly_contribution ?? 0),
    })
    setEditOpen(true)
  }

  const closeEdit = () => setEditOpen(false)
  const updateEdit = (field, value) => setEditForm((f) => ({ ...f, [field]: value }))

  const saveEditPlan = async () => {
    if (!goalId) return

    if (
      !String(editForm.current_age || '').trim() ||
      !String(editForm.target_age || '').trim() ||
      !String(editForm.target_amount || '').trim()
    ) {
      showToast('Please fill in current age, target age and target amount', 'error')
      return
    }

    const payload = {
      name: editForm.name,
      current_age: numFrom(editForm.current_age, 0),
      target_age: numFrom(editForm.target_age, 0),
      target_amount: numFrom(editForm.target_amount, 0),
      monthly_contribution: numFrom(editForm.monthly_contribution, 0),
      expected_annual_return_pct: numFrom(editForm.expected_annual_return_pct, 0),
    }

    try {
      setEditSaving(true)

      await api(`/goals/${goalId}`, { method: 'PATCH', body: payload })
      showToast('Plan updated', 'success')

      setEditOpen(false)
      setLoading(true)

      invalidatePath('/goals/primary', `/goals/${goalId}/forecast`)

      await loadForecast(payload.monthly_contribution, payload.expected_annual_return_pct, { force: true })

      justAppliedRef.current = true
      Promise.resolve()
        .then(async () => {
          await loadPrimaryGoal?.()
        })
        .catch(() => {})
    } catch (e) {
      console.error(e)
      showToast(e?.message || String(e), 'error')
    } finally {
      setEditSaving(false)
      setLoading(false)
    }
  }

  // ─── Derived data ───────────────────────────────────────
  const derived = useMemo(() => {
    const goal = forecast?.goal || primaryGoal || null
    const ccy = (forecast?.base_currency || baseCurrency || 'GBP').toUpperCase()

    const status = forecast?.status || 'on_track'
    const projEnd = Number(forecast?.projected_end_value || 0)
    const targetAmt = Number(goal?.target_amount || 0)
    const yearsRemaining = Number(forecast?.years_remaining || 0)
    const currentNW = Number(forecast?.current_net_worth || 0)

    const freedom = forecast?.freedom || null
    const freedomYearNum = freedom?.hit_year != null ? Number(freedom.hit_year) : null
    const yearsToGoal = freedom?.years_to_goal ?? null
    const hitMonth = freedom?.hit_month ?? null
    const currentAge = goal?.current_age ?? null

    const freedomAge =
      hitMonth != null && currentAge != null
        ? Math.round((Number(currentAge) + Number(hitMonth) / 12) * 10) / 10
        : null

    const plus100Year =
      whatIf?.plus100?.freedom?.hit_year != null ? Number(whatIf.plus100.freedom.hit_year) : null
    const plus250Year =
      whatIf?.plus250?.freedom?.hit_year != null ? Number(whatIf.plus250.freedom.hit_year) : null

    const displayProjEnd = deflate(projEnd, yearsRemaining)
    const displayTarget = targetAmt

    const gap = displayTarget - displayProjEnd
    const absGap = Math.abs(gap)

    const currentMc = numFrom(localContrib, 0)
    const annualEr = numFrom(localReturn, 0)
    const reqMc =
      settingsReady && isPro && targetAmt > 0 && yearsRemaining > 0
        ? requiredMonthlyContribution({
            pv: currentNW,
            fv: targetAmt,
            yearsRemaining,
            annualReturnPct: annualEr,
          })
        : null
    const deltaMc = reqMc != null ? Math.max(0, reqMc - currentMc) : null

    return {
      goal,
      ccy,
      status,
      projEnd,
      targetAmt,
      yearsRemaining,
      currentNW,
      freedomYearNum,
      yearsToGoal,
      freedomAge,
      plus100Year,
      plus250Year,
      displayProjEnd,
      displayTarget,
      gap,
      absGap,
      reqMc,
      deltaMc,
    }
  }, [
    forecast,
    primaryGoal,
    baseCurrency,
    whatIf,
    deflate,
    localContrib,
    localReturn,
    settingsReady,
    isPro,
  ])

  const statusLabels = {
    ahead: 'Ahead of plan',
    on_track: 'On track',
    adjust: 'Adjust to stay on track',
  }

  const statusColors = {
    ahead:
      'text-emerald-600 dark:text-emerald-300/[0.8] bg-emerald-300/[.08] border border-emerald-300/[.12]',
    on_track:
      'text-ink dark:text-white bg-black/[.04] dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.08]',
    adjust:
      'text-red-400 dark:text-red-300/[0.6] bg-red-300/[.06] border border-red-300/[.12]',
  }

  // Chart data
  const chartData = useMemo(() => {
    const projPoints = forecast?.projected_points || []
    const reqPoints = forecast?.required_points || []
    const out = []

    for (let i = 0; i < projPoints.length; i++) {
      if (i === 0 || i % 6 === 0 || i === projPoints.length - 1) {
        const pp = projPoints[i]
        const rp = reqPoints[i] || {}
        const yearsOut = i / 12
        out.push({
          date: pp.date,
          label: new Date(pp.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
          projected: deflate(pp.value, yearsOut),
          required: rp.value ? deflate(rp.value, yearsOut) : null,
        })
      }
    }
    return out
  }, [forecast, deflate])

  const projChartData = useMemo(() => {
    if (!projData) return []
    const pHist = projHistory || []
    const pPoints = projData.points || []
    const out = []

    for (const h of pHist) out.push({ date: h.date, actual: h.net_worth, projected: null })

    for (let i = 0; i < pPoints.length; i++) {
      if (i === 0 || i % 3 === 0 || i === pPoints.length - 1) {
        const yearsOut = i / 12
        out.push({
          date: pPoints[i].date,
          actual: null,
          projected: deflate(pPoints[i].projected_net_worth, yearsOut),
        })
      }
    }

    out.sort((a, b) => new Date(a.date) - new Date(b.date))
    return out
  }, [projData, projHistory, deflate])

  // Milestones selection
  const milestones = projData?.milestones || []
  const filteredMilestones = useMemo(() => {
    const all = milestones
      .filter((m) => m.year <= effectiveProjYears)
      .sort((a, b) => a.year - b.year)
    if (!all.length) return []

    const yearsForHorizon = (h) => {
      if (h <= 1) return [1]
      if (h <= 5) return [1, 2, 3, 5]
      if (h <= 10) return [1, 3, 5, 10]
      if (h <= 15) return [3, 5, 10, 15]
      if (h <= 20) return [5, 10, 15, 20]
      if (h <= 25) return [5, 10, 20, 25]
      if (h <= 30) return [5, 10, 20, 30]
      return [10, 20, 30, 40]
    }

    const wantYears = yearsForHorizon(effectiveProjYears).filter((y) => y <= effectiveProjYears)

    const pickForYear = (y) => {
      const exact = all.find((m) => m.year === y)
      if (exact) return exact
      for (let i = all.length - 1; i >= 0; i--) {
        if (all[i].year < y) return all[i]
      }
      return all[0]
    }

    const picked = []
    for (const y of wantYears) {
      const m = pickForYear(y)
      if (m && !picked.some((p) => p.year === m.year)) picked.push(m)
    }

    const last = all[all.length - 1]
    if (last && !picked.some((p) => p.year === last.year)) picked.push(last)

    return picked.slice(0, 4)
  }, [milestones, effectiveProjYears])

  // UI tokens
  const inp =
    'w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const lbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2'
  const modalInp =
    'w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark-2 text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const modalLbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-wide'
  const editValid =
    String(editForm.current_age || '').trim() &&
    String(editForm.target_age || '').trim() &&
    String(editForm.target_amount || '').trim()

  // ─── Renders ────────────────────────────────────────────
  if (primaryGoal === undefined) {
    return (
      <div className="space-y-7 animate-fade-in">
        <div className="rounded-3xl p-7 sm:p-9 border border-black/[.04] dark:border-white/[.05] bg-white dark:bg-surface-dark-2">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="h-9 w-40 rounded-lg skeleton" />
              <div className="h-9 w-24 rounded-2xl skeleton" />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-20 rounded-full skeleton" />
              <div className="h-7 w-56 rounded-full skeleton" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6 border border-black/[.04] dark:border-white/[.05] bg-white dark:bg-surface-dark-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 rounded skeleton" />
                <div className="h-6 w-24 rounded skeleton" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-6 border border-black/[.04] dark:border-white/[.05] bg-white dark:bg-surface-dark-2">
          <div className="h-3 w-32 rounded skeleton mb-4" />
          <div className="h-[240px] rounded-xl skeleton" />
        </div>
      </div>
    )
  }

  if (primaryGoal === null) {
    return (
      <div className="space-y-7">
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
          Outlook
        </h1>
        <Card className="p-10 text-center">
          <p className="text-ink-muted dark:text-white/40 mb-4">
            Set a primary goal to unlock your financial outlook.
          </p>
          <button
            onClick={() => setPage('goal_setup')}
            className="text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors"
            type="button"
          >
            Set up goal
          </button>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-7 animate-fade-in">
        <div className="rounded-3xl p-7 sm:p-9 border border-black/[.04] dark:border-white/[.05] bg-white dark:bg-surface-dark-2">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="h-9 w-40 rounded-lg skeleton" />
              <div className="h-9 w-24 rounded-2xl skeleton" />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-20 rounded-full skeleton" />
              <div className="h-7 w-56 rounded-full skeleton" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-6 border border-black/[.04] dark:border-white/[.05] bg-white dark:bg-surface-dark-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 rounded skeleton" />
                <div className="h-6 w-24 rounded skeleton" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-6 border border-black/[.04] dark:border-white/[.05] bg-white dark:bg-surface-dark-2">
          <div className="h-3 w-32 rounded skeleton mb-4" />
          <div className="h-[240px] rounded-xl skeleton" />
        </div>
      </div>
    )
  }

  if (error && !forecast) {
    return (
      <div className="space-y-7">
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
          Outlook
        </h1>
        <Card className="p-8 text-center">
          <AlertTriangle size={32} className="text-amber-500 mx-auto mb-4" />
          <p className="text-sm text-ink-muted dark:text-white/50 mb-2">Unable to load forecast</p>
          <p className="text-xs text-ink-muted/50 dark:text-white/25 mb-5">{error}</p>
          <button
            onClick={retryForecast}
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors"
            type="button"
          >
            <RefreshCw size={15} /> Retry
          </button>
        </Card>
      </div>
    )
  }

  const goal = derived.goal
  const ccy = derived.ccy
  const status = derived.status

  return (
    <div className="space-y-7">
      {error && forecast && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle size={16} />
          <span>
            Forecast may be outdated.{' '}
            <button onClick={retryForecast} className="underline font-medium" type="button">
              Retry
            </button>
          </span>
        </div>
      )}

      {/* Executive Summary */}
      <div className="strategy-header rounded-3xl p-7 sm:p-9">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
              {goal?.name || 'Outlook'}
            </h1>
            <button
              onClick={openEdit}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-2xl bg-white/70 dark:bg-white/[.06] text-ink dark:text-white border border-black/[.06] dark:border-white/[.08] hover:bg-white transition-colors"
              type="button"
            >
              <Pencil size={16} /> Edit plan
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${statusColors[status]}`}>
              {statusLabels[status]}
            </span>

            <div className="text-xs text-ink-muted dark:text-white/35">
              Based on your current net worth and contribution rate.
            </div>

            {settingsReady &&
              (isPro ? (
                <button
                  onClick={() => setInflationAdj((v) => !v)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    inflationAdj
                      ? 'bg-accent/10 border-accent/20 text-accent dark:text-blue-400'
                      : 'bg-transparent border-black/[.06] dark:border-white/[.06] text-ink-muted/60 dark:text-white/30 hover:text-ink dark:hover:text-white/50'
                  }`}
                  type="button"
                >
                  {inflationAdj ? '📉 Real (today’s money)' : '💰 Future value (nominal)'}
                </button>
              ) : (
                <button
                  onClick={() => setPage('upgrade')}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border border-amber-500/15 text-amber-600 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-500/[.04] hover:bg-amber-50 transition-colors"
                  type="button"
                >
                  <Crown size={11} /> Real-terms modelling
                </button>
              ))}

            {feedback && (
              <span className="text-xs font-medium text-gain dark:text-emerald-400 flex items-center gap-1.5 animate-fade-in">
                <Check size={14} /> {feedback}
              </span>
            )}
          </div>

          {/* Executive Stats */}
          <div className="pt-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 items-end">
              <div>
                <div className="text-xs text-ink-muted/50 dark:text-white/25 mb-1">
                  Projected at age {goal?.target_age}
                  {inflationAdj ? ' (today’s money)' : ''}
                </div>
                <div className="font-display text-2xl text-ink dark:text-white tabular-nums">
                  {fmtCurrencyCompact(derived.displayProjEnd, ccy)}
                </div>
              </div>

              <div>
                <div className="text-xs text-ink-muted/50 dark:text-white/25 mb-1">
                  Your target{inflationAdj ? ' (today’s money)' : ''}
                </div>
                <div className="font-display text-2xl text-ink dark:text-white tabular-nums">
                  {fmtCurrencyCompact(derived.displayTarget, ccy)}
                </div>
              </div>

              <div>
                <div className="text-xs text-ink-muted/50 dark:text-white/25 mb-1">Current net worth</div>
                <div className="font-display text-2xl text-ink dark:text-white tabular-nums">
                  {fmtCurrencyCompact(derived.currentNW, ccy)}
                </div>
              </div>

              <div>
                <div className="text-xs text-ink-muted/50 dark:text-white/25 mb-1">Years to target age</div>
                <div className="font-display text-2xl text-ink dark:text-white tabular-nums">
                  {derived.yearsRemaining}
                </div>
              </div>
            </div>

            {/* Optimiser */}
            {settingsReady && isPro && status === 'adjust' && derived.reqMc != null && (
              <div className="mt-4 pt-4 border-t border-black/[.06] dark:border-white/[.08]">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-ink-3 dark:text-white/50 tracking-wide">
                      Optimiser
                    </div>
                    <div className="mt-1 text-sm text-ink-muted dark:text-white/40">
                      To hit your target by age {goal?.target_age}, aim for{' '}
                      <span className="font-medium text-ink dark:text-white">
                        {fmtCurrency(Math.ceil(derived.reqMc), ccy)}/mo
                      </span>
                      {derived.deltaMc != null && derived.deltaMc > 0 ? (
                        <>
                          {' '}
                          (+{' '}
                          <span className="font-medium text-ink dark:text-white">
                            {fmtCurrency(Math.ceil(derived.deltaMc), ccy)}/mo
                          </span>
                          )
                        </>
                      ) : null}
                      .
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      const next = Math.ceil(derived.reqMc)
                      const nextStr = String(next)

                      setLocalContrib(nextStr)
                      setDirty(true)

                      await applyAssumptions({ mcOverride: next })
                    }}
                    className="inline-flex items-center justify-center
                    px-5 py-2.5 rounded-2xl text-sm font-semibold
                    bg-accent text-white
                    hover:bg-accent/90 active:scale-[0.98]
                    transition-all duration-150
                    shadow-sm hover:shadow-md
                    disabled:opacity-50 disabled:cursor-not-allowed
                    min-h-[42px]"
                  >
                    Set & update
                  </button>
                </div>
              </div>
            )}

            {/* Independence */}
            <div className="mt-2 rounded-3xl border border-black/[.06] dark:border-white/[.08] bg-white/60 dark:bg-white/[.04] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-ink-3 dark:text-white/50 tracking-wide">
                    Independence
                  </div>

                  {settingsReady && isPro ? (
                    <>
                      <div className="mt-2 font-display text-2xl text-ink dark:text-white leading-tight">
                        {derived.freedomAge != null ? (
                          <>
                            Age {derived.freedomAge}
                            {derived.freedomYearNum != null ? (
                              <span className="ml-2 text-sm font-sans text-ink-muted/60 dark:text-white/35">
                                ({derived.freedomYearNum})
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <>Off target</>
                        )}
                      </div>

                      <div className="mt-2 text-sm text-ink-muted dark:text-white/40">
                        {derived.freedomAge != null ? (
                          derived.yearsToGoal != null ? (
                            `${derived.yearsToGoal} years away at your current pace.`
                          ) : (
                            'Timeline updates as your net worth changes.'
                          )
                        ) : (
                          'Consider adjusting your monthly contribution to stay on track.'
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-2 font-display text-2xl text-ink-muted/40 dark:text-white/25 leading-tight">
                        Freedom timeline
                      </div>
                      <div className="mt-2 text-sm text-ink-muted dark:text-white/40">
                        Unlock independence timing and scenario modelling.
                      </div>
                    </>
                  )}
                </div>

                {!isPro && settingsReady && (
                  <button
                    onClick={() => setPage('upgrade')}
                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-2xl bg-amber-50/60 dark:bg-amber-500/[.06] text-amber-700 dark:text-amber-200 border border-amber-500/15 hover:bg-amber-50 transition-colors shrink-0"
                    type="button"
                  >
                    <Lock size={16} /> Go Pro
                  </button>
                )}
              </div>

              {settingsReady &&
                isPro &&
                derived.freedomYearNum != null &&
                (derived.plus100Year != null || derived.plus250Year != null) && (
                  <div className="mt-4 pt-4 border-t border-black/[.06] dark:border-white/[.08] text-[13px] text-ink-muted dark:text-white/40">
                    {derived.plus100Year != null && (
                      <div>
                        +£100/mo →{' '}
                        <span className="font-medium text-ink dark:text-white">{derived.plus100Year}</span>
                        {derived.plus100Year < derived.freedomYearNum ? (
                          <span className="text-gain dark:text-emerald-300/90">
                            {' '}
                            ({derived.freedomYearNum - derived.plus100Year} years earlier)
                          </span>
                        ) : null}
                      </div>
                    )}
                    {derived.plus250Year != null && (
                      <div className="mt-1">
                        +£250/mo →{' '}
                        <span className="font-medium text-ink dark:text-white">{derived.plus250Year}</span>
                        {derived.plus250Year < derived.freedomYearNum ? (
                          <span className="text-gain dark:text-emerald-300/90">
                            {' '}
                            ({derived.freedomYearNum - derived.plus250Year} years earlier)
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Trajectory */}
      <Card className="p-0 overflow-hidden sm:rounded-3xl rounded-2xl">
        <details className="group" open={trajOpen} onToggle={(e) => setTrajOpen(e.currentTarget.open)}>
          <summary
            className="
              [&::-webkit-details-marker]:hidden
              list-none cursor-pointer select-none
              px-4 sm:px-8 py-4
              flex items-start justify-between gap-4
              bg-white/60 dark:bg-white/[.04]
              border-b border-black/[.06] dark:border-white/[.08]
            "
          >
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink dark:text-white">Trajectory</h3>
              <div className="mt-1 text-xs text-ink-muted dark:text-white/35">Projected net worth over time</div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-muted dark:text-white/35">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-accent rounded-full inline-block" /> Projected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-ink-muted/30 dark:bg-white/20 rounded-full inline-block" /> Required
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border-2 border-amber-500 rounded-full inline-block" /> Target
                </span>
              </div>
            </div>

            <ChevronDown className="h-5 w-5 text-ink-muted dark:text-white/50 shrink-0 group-open:rotate-180 transition-transform mt-0.5" />
          </summary>

          <div className="px-4 sm:px-8 py-5 sm:py-6">
            {chartData.length > 1 ? (
              <div className="h-[320px] sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={chartMargin}>
                    <defs>
                      <linearGradient id="trajFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT_STROKE} stopOpacity={0.08} />
                        <stop offset="100%" stopColor={ACCENT_STROKE} stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid {...gridProps} />

                    <XAxis
                      dataKey="date"
                      {...xAxisProps}
                      tickFormatter={(d) =>
                        new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
                      }
                    />

                    <YAxis {...yAxisProps} tickFormatter={compactTickFormatter} />

                    <Tooltip content={<WealthTooltip currency={ccy} />} {...tooltipProps} />

                    <ReferenceLine
                      y={derived.displayTarget}
                      stroke="#d97706"
                      strokeDasharray="4 6"
                      strokeOpacity={0.35}
                    />

                    <Area
                      type="monotone"
                      dataKey="required"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeOpacity={0.12}
                      strokeDasharray="6 4"
                      fill="none"
                      dot={false}
                      connectNulls
                    />

                    <Area
                      type="monotone"
                      dataKey="projected"
                      stroke={ACCENT_STROKE}
                      strokeWidth={2.25}
                      fill="url(#trajFill)"
                      dot={false}
                      activeDot={activeDotStyle}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-ink-muted dark:text-white/30 text-sm">
                Add accounts to see your trajectory
              </div>
            )}

            <div className="mt-5 rounded-3xl bg-white/70 dark:bg-white/[.05] border border-black/[.06] dark:border-white/[.08] p-4 sm:p-5">
              <div className="text-xs font-semibold text-ink-muted dark:text-white/50 mb-3">Assumptions</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className={lbl}>Monthly contribution ({ccy})</label>
                  <input
                    value={localContrib}
                    onChange={(e) => {
                      setLocalContrib(e.target.value)
                      setDirty(true)
                    }}
                    className={inp}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label className={lbl}>Expected annual return (%)</label>

                  <input
                    value={localReturn}
                    onChange={(e) => {
                      setLocalReturn(e.target.value)
                      setDirty(true)
                    }}
                    className={inp}
                    inputMode="decimal"
                  />

                  <div className="flex gap-2 mt-3">
                    {[
                      { label: 'Conservative', value: 3 },
                      { label: 'Balanced', value: 5 },
                      { label: 'Growth', value: 7 },
                    ].map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          setLocalReturn(String(s.value))
                          setDirty(true)
                        }}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition
                          ${
                            Number(localReturn) === s.value
                              ? 'bg-accent text-white border-accent'
                              : 'border-black/[.08] dark:border-white/[.08] text-ink-muted dark:text-white/40 hover:text-ink dark:hover:text-white'
                          }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {dirty && (
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        applyAssumptions()
                      }}
                      className="text-sm font-semibold px-5 py-3 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all min-h-[44px] w-full sm:w-auto disabled:opacity-50"
                      disabled={loading}
                    >
                      {loading ? 'Updating…' : 'Update projection'}
                    </button>
                  </div>
                )}
              </div>

              <p className="mt-3 text-xs text-ink-muted/50 dark:text-white/25 leading-relaxed">
                Assumes {fmtCurrency(numFrom(localContrib, 0), ccy)}/month at {numFrom(localReturn, 0)}% annual growth.
                Returns are compounded monthly.
              </p>
            </div>
          </div>
        </details>
      </Card>

      {/* Account Projections */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setProjOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 sm:px-7 py-5 text-sm font-semibold text-ink dark:text-white hover:bg-surface-2/50 dark:hover:bg-white/[.02] transition-colors"
          type="button"
        >
          <div className="flex items-center gap-2.5">
            <TrendingUp size={16} className="text-accent" />
            <span>Account Projections</span>
            {settingsReady && !isPro && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <Crown size={10} /> Pro
              </span>
            )}
          </div>
          {projOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {projOpen && (
          <div className="border-t border-black/[.04] dark:border-white/[.04] animate-fade-in">
            <div className="px-4 sm:px-7 pt-5 pb-3 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-ink-muted dark:text-white/35">
                Based on your accounts&apos; contributions and expected returns.
              </p>

              <div className="flex bg-surface-2 dark:bg-white/5 rounded-full p-0.5 gap-0.5">
                {HORIZONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setProjYears(h)}
                    className={`text-xs font-semibold px-3.5 py-2 rounded-full transition-all min-w-[44px] min-h-[36px] ${
                      effectiveProjYears === h
                        ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm'
                        : 'text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white/60'
                    }`}
                    type="button"
                  >
                    {h}Y
                  </button>
                ))}

                {settingsReady && !isPro && (
                  <button
                    onClick={() => setPage('upgrade')}
                    className="text-xs font-semibold px-3.5 py-2 rounded-full text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 transition-all flex items-center gap-1"
                    type="button"
                  >
                    <Lock size={11} /> More
                  </button>
                )}
              </div>
            </div>

            {projLoading ? (
              <div className="px-7 pb-7">
                <div className="h-[260px] rounded-2xl skeleton" />
              </div>
            ) : !projData || !projData.points?.length ? (
              <div className="px-7 pb-7 text-center py-10">
                <p className="text-sm text-ink-muted dark:text-white/35">
                  Add accounts with balances to see projections.
                </p>
              </div>
            ) : (
              <div className="px-4 sm:px-7 pb-7 space-y-5">
                {filteredMilestones.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {filteredMilestones.map((m) => (
                      <div
                        key={m.year}
                        className="p-4 sm:p-5 rounded-2xl border border-black/[.05] dark:border-white/[.05] bg-surface dark:bg-surface-dark"
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <Calendar size={11} className="text-ink-muted/70 dark:text-white/30" />
                          <span className="text-[12px] font-semibold tracking-[.12em] uppercase text-ink-muted/65 dark:text-white/30">
                            In {m.year}y
                          </span>
                        </div>

                        <div className="font-display text-xl sm:text-2xl text-ink dark:text-white tracking-tight tabular-nums leading-tight">
                          {fmtCurrency(deflate(m.projected_net_worth, m.year), ccy)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="h-[280px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projChartData} margin={chartMargin}>
                      <defs>
                        <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ACCENT_STROKE} stopOpacity={0.08} />
                          <stop offset="100%" stopColor={ACCENT_STROKE} stopOpacity={0} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid {...gridProps} />

                      <XAxis
                        dataKey="date"
                        {...xAxisProps}
                        tickFormatter={(d) =>
                          new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
                        }
                      />

                      <YAxis {...yAxisProps} tickFormatter={compactTickFormatter} />

                      <Tooltip content={<WealthTooltip currency={ccy} />} {...tooltipProps} />

                      <Area
                        type="monotone"
                        dataKey="actual"
                        stroke={ACCENT_STROKE}
                        strokeWidth={2}
                        fill="url(#projFill)"
                        dot={false}
                        connectNulls={false}
                        activeDot={activeDotStyle}
                      />

                      <Area
                        type="monotone"
                        dataKey="projected"
                        stroke={ACCENT_STROKE}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        fill="none"
                        dot={false}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {settingsReady && !isPro && filteredMilestones.length > 0 && (
                  <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-amber-50 dark:bg-amber-500/[.06] border border-amber-500/15">
                    <div>
                      <div className="text-sm font-semibold text-ink dark:text-white">See the full picture</div>
                      <div className="text-xs text-ink-muted dark:text-white/35 mt-0.5">
                        Unlock 5–40 year projections, milestones and strategic tools.
                      </div>
                    </div>
                    <UpgradeButton onClick={() => setPage('upgrade')} size="sm">
                      Upgrade
                    </UpgradeButton>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Edit Plan Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-[560px] bg-white dark:bg-surface-dark-2 rounded-3xl shadow-card-lg border border-black/[.06] dark:border-white/[.08] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-xs font-semibold tracking-[.10em] uppercase text-ink-muted dark:text-white/35">
                  Edit plan
                </div>
                <div className="text-sm text-ink-muted/60 dark:text-white/30 mt-1">
                  Update your target and timeline.
                </div>
              </div>
              <button
                onClick={closeEdit}
                className="p-2 rounded-2xl hover:bg-black/[.04] dark:hover:bg-white/[.06] transition-colors"
                aria-label="Close"
                type="button"
              >
                <X size={18} className="text-ink dark:text-white" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className={modalLbl}>Goal name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => updateEdit('name', e.target.value)}
                  className={modalInp}
                  placeholder="Retirement"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={modalLbl}>Your current age</label>
                  <input
                    value={editForm.current_age}
                    onChange={(e) => updateEdit('current_age', e.target.value)}
                    className={modalInp}
                    placeholder="32"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className={modalLbl}>Target age</label>
                  <input
                    value={editForm.target_age}
                    onChange={(e) => updateEdit('target_age', e.target.value)}
                    className={modalInp}
                    placeholder="60"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div>
                <label className={modalLbl}>Target amount ({ccy})</label>
                <input
                  value={editForm.target_amount}
                  onChange={(e) => updateEdit('target_amount', e.target.value)}
                  className={modalInp}
                  placeholder="1,000,000"
                  inputMode="decimal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={modalLbl}>Monthly contribution ({ccy})</label>
                  <input
                    value={editForm.monthly_contribution}
                    onChange={(e) => updateEdit('monthly_contribution', e.target.value)}
                    className={modalInp}
                    placeholder="500"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className={modalLbl}>Expected annual return (%)</label>
                  <input
                    value={editForm.expected_annual_return_pct}
                    onChange={(e) => updateEdit('expected_annual_return_pct', e.target.value)}
                    className={modalInp}
                    placeholder="7"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={closeEdit}
                  className="px-5 py-3 rounded-2xl text-sm font-semibold bg-surface-2 dark:bg-white/[.06] text-ink dark:text-white hover:opacity-90 transition-opacity"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditPlan}
                  disabled={!editValid || editSaving}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold bg-accent text-white hover:bg-accent-dark transition-colors disabled:opacity-40"
                  type="button"
                >
                  <Save size={16} /> {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}