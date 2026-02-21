import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from "../api"
import { useApp } from '../App'
import Card from '../components/Card'
import { fmtCurrency, fmtCurrencyCompact } from '../utils'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import {
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  RefreshCw,
  Pencil,
  X,
  Save,
} from 'lucide-react'
import WealthTooltip from '../components/charts/WealthTooltip'
import { xAxisProps, yAxisProps, gridProps, tooltipProps, compactTickFormatter, chartMargin, ACCENT_STROKE, activeDotStyle } from '../components/charts/chartTheme'

export default function Strategy() {
  const { baseCurrency, setPage, primaryGoal, showToast, loadPrimaryGoal, bumpData } = useApp()
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [assumptionsOpen, setAssumptionsOpen] = useState(false)
  const [localContrib, setLocalContrib] = useState('')
  const [localReturn, setLocalReturn] = useState('')
  const [dirty, setDirty] = useState(false)

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

  const goalId = primaryGoal?.id

  const loadForecast = useCallback(async (mc, er) => {
    if (!goalId) return
    setError(null)

    try {
      let url = `/goals/${goalId}/forecast`
      const params = []
      if (mc !== undefined && mc !== '') params.push(`monthly_contribution=${encodeURIComponent(mc)}`)
      if (er !== undefined && er !== '') params.push(`expected_return=${encodeURIComponent(er)}`)
      if (params.length) url += '?' + params.join('&')

      const d = await api(url)
      setForecast(d)
    } catch (e) {
      console.error('Strategy forecast error:', e)
      setError(e?.message || 'Failed to load forecast')
    } finally {
      setLoading(false)
    }
  }, [goalId])

  useEffect(() => {
    if (primaryGoal) {
      setLocalContrib(String(primaryGoal.monthly_contribution || 0))
      setLocalReturn(String(primaryGoal.expected_annual_return_pct || 7))

      setEditForm({
        name: primaryGoal.name || 'Retirement',
        current_age: String(primaryGoal.current_age ?? ''),
        target_age: String(primaryGoal.target_age ?? '60'),
        target_amount: String(primaryGoal.target_amount ?? ''),
        expected_annual_return_pct: String(primaryGoal.expected_annual_return_pct ?? 7),
        monthly_contribution: String(primaryGoal.monthly_contribution ?? 0),
      })

      setLoading(true)
      loadForecast()
    } else {
      setForecast(null)
      setLoading(false)
    }
  }, [primaryGoal, loadForecast])

  const showFeedback = (msg) => {
    setFeedback(msg)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000)
  }

  const retryForecast = () => {
    setLoading(true)
    setError(null)
    loadForecast()
  }

  const applyAssumptions = async () => {
    if (!goalId) return

    const mc = Number(String(localContrib).replace(/,/g, ''))
    const er = Number(String(localReturn).replace(/,/g, ''))

    const prevStatus = forecast?.status

    try {
      // ✅ PATCH goal assumptions (explicit method/body)
      await api(`/goals/${goalId}`, {
        method: 'PATCH', // change to 'PUT' if your backend only supports PUT
        body: {
          monthly_contribution: mc,
          expected_annual_return_pct: er,
        },
      })

      await loadPrimaryGoal()
      bumpData()
      setDirty(false)

      setLoading(true)
      await loadForecast(mc, er)

      // Optional feedback check (non-blocking)
      try {
        const newForecast = await api(
          `/goals/${goalId}/forecast?monthly_contribution=${encodeURIComponent(mc)}&expected_return=${encodeURIComponent(er)}`
        )
        if (newForecast.status === 'on_track' || newForecast.status === 'ahead') {
          if (prevStatus === 'adjust') showFeedback("You're now on track.")
        }
      } catch {
        // ignore feedback check failure
      }
    } catch (e) {
      console.error(e)
      showToast(e?.message || String(e), 'error')
    } finally {
      setLoading(false)
    }
  }

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
      current_age: Number(String(editForm.current_age).replace(/,/g, '')),
      target_age: Number(String(editForm.target_age).replace(/,/g, '')),
      target_amount: Number(String(editForm.target_amount).replace(/,/g, '')),
      monthly_contribution: Number(String(editForm.monthly_contribution || 0).replace(/,/g, '')),
      expected_annual_return_pct: Number(String(editForm.expected_annual_return_pct || 0).replace(/,/g, '')),
    }

    try {
      setEditSaving(true)

      // ✅ PATCH goal (explicit method/body)
      await api(`/goals/${goalId}`, {
        method: 'PATCH', // change to 'PUT' if your backend only supports PUT
        body: payload,
      })

      showToast('Plan updated', 'success')

      await loadPrimaryGoal()
      bumpData()
      setEditOpen(false)

      setLoading(true)
      await loadForecast(payload.monthly_contribution, payload.expected_annual_return_pct)
    } catch (e) {
      console.error(e)
      showToast(e?.message || String(e), 'error')
    } finally {
      setEditSaving(false)
      setLoading(false)
    }
  }

  if (!primaryGoal) {
    return (
      <div className="space-y-7">
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">Strategy</h1>
        <Card className="p-10 text-center">
          <p className="text-ink-muted dark:text-white/40 mb-4">
            Set a primary goal to use the Strategy workspace.
          </p>
          <button
            onClick={() => setPage('home')}
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
      <div className="space-y-6">
        <div className="h-12 w-64 rounded-lg skeleton" />
        <div className="h-[180px] rounded-2xl skeleton" />
        <div className="h-[320px] rounded-2xl skeleton" />
      </div>
    )
  }

  if (error && !forecast) {
    return (
      <div className="space-y-7">
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">Strategy</h1>
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

  const goal = forecast?.goal || primaryGoal
  const ccy = forecast?.base_currency || baseCurrency
  const status = forecast?.status || 'on_track'
  const projEnd = forecast?.projected_end_value || 0
  const targetAmt = goal?.target_amount || 0
  const yearsRemaining = forecast?.years_remaining || 0
  const currentNW = forecast?.current_net_worth || 0

  const statusLabels = {
    ahead: 'Ahead of plan',
    on_track: 'On track',
    adjust: 'Adjust to stay on track',
  }
  const statusColors = {
    ahead: 'text-gain dark:text-emerald-400 bg-gain/10',
    on_track: 'text-accent dark:text-blue-400 bg-accent/10',
    adjust: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  }

  const projPoints = forecast?.projected_points || []
  const reqPoints = forecast?.required_points || []
  const chartData = []
  for (let i = 0; i < projPoints.length; i++) {
    if (i === 0 || i % 6 === 0 || i === projPoints.length - 1) {
      const pp = projPoints[i]
      const rp = reqPoints[i] || {}
      chartData.push({
        date: pp.date,
        label: new Date(pp.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        projected: pp.value,
        required: rp.value || null,
      })
    }
  }

  const inp =
    "w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
  const lbl = "block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2"

  const modalInp =
    "w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark-2 text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
  const modalLbl =
    "block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-wide"

  const editValid =
    String(editForm.current_age || '').trim() &&
    String(editForm.target_age || '').trim() &&
    String(editForm.target_amount || '').trim()

  return (
    <div className="space-y-7">
      {error && forecast && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle size={16} />
          <span>
            Forecast may be outdated.{' '}
            <button onClick={retryForecast} className="underline font-medium" type="button">Retry</button>
          </span>
        </div>
      )}

      <div className="strategy-header rounded-3xl p-7 sm:p-9">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
              {goal?.name || 'Strategy'}
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
            {feedback && (
              <span className="text-xs font-medium text-gain dark:text-emerald-400 flex items-center gap-1.5 animate-fade-in">
                <Check size={14} /> {feedback}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4">
            <div>
              <div className="text-xs text-ink-muted/50 dark:text-white/25 mb-1">Projected Outcome</div>
              <div className="font-display text-2xl text-ink dark:text-white tabular-nums">
                {fmtCurrencyCompact(projEnd, ccy)}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-muted/50 dark:text-white/25 mb-1">Target</div>
              <div className="font-display text-2xl text-ink dark:text-white tabular-nums">
                {fmtCurrencyCompact(targetAmt, ccy)}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-muted/50 dark:text-white/25 mb-1">Current Net Worth</div>
              <div className="font-display text-2xl text-ink dark:text-white tabular-nums">
                {fmtCurrencyCompact(currentNW, ccy)}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-muted/50 dark:text-white/25 mb-1">Years Remaining</div>
              <div className="font-display text-xl text-ink dark:text-white tabular-nums">{yearsRemaining}</div>
            </div>
          </div>
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-4 mb-5">
          <h3 className="text-sm font-semibold text-ink dark:text-white">Trajectory</h3>
          <div className="flex items-center gap-4 text-xs text-ink-muted dark:text-white/35">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-accent rounded-full inline-block" /> Projected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-ink-muted/30 dark:bg-white/20 rounded-full inline-block" style={{ borderBottom: '1px dashed' }} /> Required
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 border-2 border-amber-500 rounded-full inline-block" /> Target
            </span>
          </div>
        </div>

        {chartData.length > 1 ? (
          <div className="h-[280px] sm:h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={chartMargin}>
                <defs>
                  <linearGradient id="stratFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT_STROKE} stopOpacity={0.08} />
                    <stop offset="100%" stopColor={ACCENT_STROKE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...xAxisProps} />
                <YAxis {...yAxisProps} tickFormatter={compactTickFormatter} />
                <Tooltip content={<WealthTooltip currency={baseCurrency} />} {...tooltipProps} />
                <ReferenceLine y={targetAmt} stroke="#d97706" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="required"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeOpacity={0.15}
                  strokeDasharray="6 4"
                  fill="none"
                  dot={false}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke={ACCENT_STROKE}
                  strokeWidth={2}
                  fill="url(#stratFill)"
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
      </Card>

      <Card className="overflow-hidden">
        <button
          onClick={() => setAssumptionsOpen(!assumptionsOpen)}
          className="w-full flex items-center justify-between px-7 py-5 text-sm font-semibold text-ink dark:text-white hover:bg-surface-2/50 dark:hover:bg-white/[.02] transition-colors"
          type="button"
        >
          <span>Assumptions</span>
          {assumptionsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {assumptionsOpen && (
          <div className="px-7 pb-7 space-y-5 animate-fade-in border-t border-black/[.04] dark:border-white/[.04] pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={lbl}>Monthly contribution ({ccy})</label>
                <input
                  value={localContrib}
                  onChange={e => { setLocalContrib(e.target.value); setDirty(true) }}
                  className={inp}
                  inputMode="decimal"
                  placeholder="500"
                />
              </div>
              <div>
                <label className={lbl}>Expected annual return (%)</label>
                <input
                  value={localReturn}
                  onChange={e => { setLocalReturn(e.target.value); setDirty(true) }}
                  className={inp}
                  inputMode="decimal"
                  placeholder="7"
                />
              </div>
            </div>

            {dirty && (
              <button
                onClick={applyAssumptions}
                className="text-sm font-semibold px-6 py-3 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all min-h-[44px] animate-fade-in"
                type="button"
              >
                Update projection
              </button>
            )}

            <p className="text-xs text-ink-muted/40 dark:text-white/20 leading-relaxed">
              These assumptions drive your projected outcome. Returns are compounded monthly.
              Adjust anytime to see how changes affect your plan.
            </p>
          </div>
        )}
      </Card>

      {editOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeEdit} />
          <div className="relative w-full max-w-[560px] bg-white dark:bg-surface-dark-2 rounded-3xl shadow-card-lg border border-black/[.06] dark:border-white/[.08] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-xs font-semibold tracking-[.10em] uppercase text-ink-muted dark:text-white/35">
                  Edit retirement plan
                </div>
                <div className="text-sm text-ink-muted/60 dark:text-white/30 mt-1">
                  Update your target and timeline. Projections update immediately.
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
                  <label className={modalLbl}>Target retirement age</label>
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
                  <Save size={16} /> {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StratTooltip({ active, payload, ccy }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-ink dark:bg-surface-dark-3 text-white px-4 py-3 rounded-2xl shadow-lg text-sm border border-white/5">
      {d.projected != null && (
        <div className="font-medium tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtCurrency(d.projected, ccy)} <span className="font-normal text-white/50">projected</span>
        </div>
      )}
      {d.required != null && (
        <div className="font-medium tabular-nums mt-0.5">
          {fmtCurrency(d.required, ccy)} <span className="font-normal text-white/50">required</span>
        </div>
      )}
      <div className="text-white/40 mt-1 text-xs">{d.date}</div>
    </div>
  )
}