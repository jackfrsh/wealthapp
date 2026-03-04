// frontend/src/pages/ProProjectionCard.jsx
import React, { useMemo, useState, useEffect } from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import UpgradeButton from '../components/UpgradeButton'
import { Lock, TrendingUp } from 'lucide-react'

import WealthTooltip from '../components/charts/WealthTooltip'
import {
  xAxisProps,
  yAxisProps,
  gridProps,
  tooltipProps,
  compactTickFormatter,
} from '../components/charts/chartTheme'

/* ───────────────────────────────────────────── */
/* Helpers */
/* ───────────────────────────────────────────── */

function getIncludeFlag(a) {
  return a?.include_in_net_worth === true || a?.includeInNetWorth === true
}

function getMonthlyContribution(a) {
  return Number(a?.monthly_contribution ?? a?.monthlyContribution ?? 0) || 0
}

function getAnnualReturnPct(a, fallbackAnnualReturnPct) {
  const v =
    a?.annual_interest_rate_percent ??
    a?.annualInterestRatePercent ??
    a?.expected_annual_return_pct ??
    a?.expectedAnnualReturnPct ??
    fallbackAnnualReturnPct
  const n = Number(v)
  return Number.isFinite(n) ? n : Number(fallbackAnnualReturnPct || 0)
}

function currencyFmt(n, ccy = 'GBP') {
  const v = Number(n || 0)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: ccy,
      maximumFractionDigits: 0,
    }).format(v)
  } catch {
    return `${ccy} ${Math.round(v).toLocaleString()}`
  }
}

/* ───────────────────────────────────────────── */
/* Projection calculation */
/* ───────────────────────────────────────────── */

function calcSeries({ included, horizonMonths, fallbackAnnualReturnPct, simulation, longHorizon }) {
  const itemsBase = included.map((a) => ({
    id: a.id,
    bal: Number(a?.balance || 0),
    m: getMonthlyContribution(a),
    r: (getAnnualReturnPct(a, fallbackAnnualReturnPct) / 100) / 12,
  }))

  const itemsSim = included.map((a) => {
    const baseBal = Number(a?.balance || 0)
    const isSelected = simulation?.accountId != null && String(a.id) === String(simulation.accountId)
    const lumpAdd = simulation?.mode === 'lump' && isSelected ? Number(simulation?.amount || 0) : 0

    return {
      id: a.id,
      bal: baseBal + lumpAdd,
      m: getMonthlyContribution(a),
      r: (getAnnualReturnPct(a, fallbackAnnualReturnPct) / 100) / 12,
    }
  })

  const sum = (arr) => arr.reduce((s, x) => s + x.bal, 0)
  const rows = []

  rows.push({ x: 0, label: 'Now', baseline: sum(itemsBase), simulated: sum(itemsSim) })

  for (let i = 1; i <= horizonMonths; i++) {
    for (const x of itemsBase) x.bal = x.bal * (1 + x.r) + x.m

    for (const x of itemsSim) {
      const isSelected = simulation?.accountId != null && String(x.id) === String(simulation.accountId)
      const extraMonthly = simulation?.mode === 'monthly' && isSelected ? Number(simulation?.amount || 0) : 0
      x.bal = x.bal * (1 + x.r) + x.m + extraMonthly
    }

    const isYear = i % 12 === 0
    const isHalfYear = i % 6 === 0

    rows.push({
      x: i,
      label: longHorizon
        ? isYear
          ? `${i / 12}y`
          : ''
        : isYear
        ? `${i / 12}y`
        : isHalfYear
        ? `${i}m`
        : '',
      baseline: sum(itemsBase),
      simulated: sum(itemsSim),
    })
  }

  return {
    series: rows,
    startBase: rows[0]?.baseline ?? 0,
    endBase: rows[rows.length - 1]?.baseline ?? 0,
    endSim: rows[rows.length - 1]?.simulated ?? 0,
  }
}

/* ───────────────────────────────────────────── */
/* ✅ Safe Recharts loader (never crash the page) */
/* ───────────────────────────────────────────── */

function SafeChart({
  data,
  xInterval,
  baseCurrency,
  baselineStroke,
  simStroke,
  retirementStroke,
  milestoneStroke,
  goalTarget,
  milestoneTarget,
  hasRetirement,
  hasMilestone,
}) {
  const [recharts, setRecharts] = useState(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (recharts || loadFailed) return

    ;(async () => {
      try {
        const mod = await import('recharts')
        if (cancelled) return
        setRecharts(mod)
      } catch (e) {
        if (cancelled) return
        console.error('Recharts failed to load:', e)
        setLoadFailed(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [recharts, loadFailed])

  // If the bundle can’t load, we show a stable fallback box (no ErrorBoundary).
  if (loadFailed || !recharts) {
    return (
      <div className="h-[240px] rounded-2xl bg-black/[.03] dark:bg-white/[.04] border border-black/[.06] dark:border-white/[.08] grid place-items-center">
        <div className="text-xs text-ink-muted dark:text-white/35 text-center px-6">
          Chart unavailable right now. Your projection totals still work.
        </div>
      </div>
    )
  }

  const {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine,
  } = recharts

  // Extra safety: if Recharts renders throw (minified vendor crash), catch and fallback.
  try {
    return (
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...xAxisProps} interval={xInterval} minTickGap={10} />
            <YAxis {...yAxisProps} width={46} tickFormatter={(v) => compactTickFormatter(v)} />

            <Tooltip {...tooltipProps} content={(p) => <WealthTooltip {...p} currency={baseCurrency} />} />

            {hasRetirement ? (
              <ReferenceLine y={Number(goalTarget)} strokeDasharray="4 4" stroke={retirementStroke} />
            ) : null}

            {hasMilestone ? (
              <ReferenceLine y={Number(milestoneTarget)} strokeDasharray="3 6" stroke={milestoneStroke} />
            ) : null}

            <Line type="monotone" dataKey="baseline" stroke={baselineStroke} strokeWidth={2} dot={false} isAnimationActive />
            <Line type="monotone" dataKey="simulated" stroke={simStroke} strokeWidth={2} dot={false} isAnimationActive />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  } catch (e) {
    console.error('Recharts render crashed:', e)
    return (
      <div className="h-[240px] rounded-2xl bg-black/[.03] dark:bg-white/[.04] border border-black/[.06] dark:border-white/[.08] grid place-items-center">
        <div className="text-xs text-ink-muted dark:text-white/35 text-center px-6">
          Chart failed to render. Your projection totals still work.
        </div>
      </div>
    )
  }
}

/* ───────────────────────────────────────────── */
/* Main Component */
/* ───────────────────────────────────────────── */

export default function ProProjectionCard({
  accounts = [],
  goalTarget = null,
  goalName = 'Retirement',
  milestoneTarget = null,
  fallbackAnnualReturnPct = 7,
  simulation = null,
}) {
  const app = useApp()
  const isPro = !!app?.isPro
  const setPage = app?.setPage
  const baseCurrency = (app?.baseCurrency || 'GBP').toUpperCase()

  // support both names safely (you’ve had dark in other files)
  const dark = app?.dark ?? app?.isDark ?? false

  const included = (accounts || []).filter(getIncludeFlag)
  const canChart = included.length > 0

  const OPTIONS = [
    { id: '12m', label: '12m', months: 12 },
    { id: '24m', label: '24m', months: 24 },
    { id: '5y', label: '5y', months: 60 },
    { id: '10y', label: '10y', months: 120 },
    { id: '20y', label: '20y', months: 240 },
  ]

  const [horizon, setHorizon] = useState('24m')

  useEffect(() => {
    if (!OPTIONS.some((o) => o.id === horizon)) setHorizon('24m')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const horizonMonths = useMemo(() => {
    const found = OPTIONS.find((o) => o.id === horizon)
    return found ? found.months : 24
  }, [horizon])

  const longHorizon = horizonMonths >= 120

  const { series, startBase, endBase, endSim } = useMemo(() => {
    return calcSeries({ included, horizonMonths, fallbackAnnualReturnPct, simulation, longHorizon })
  }, [included, horizonMonths, fallbackAnnualReturnPct, simulation, longHorizon])

  const baselineStroke = dark ? 'rgba(255,255,255,.20)' : 'rgba(0,0,0,.22)'
  const simStroke = 'var(--accent)'

  const retirementStroke = 'rgba(245,158,11,0.70)'
  const milestoneStroke = dark ? 'rgba(52,211,153,0.75)' : 'rgba(16,185,129,0.70)'

  const locked = !isPro
  const chartOpacity = locked ? 'opacity-25' : 'opacity-100'

  const xInterval = useMemo(() => {
    if (horizonMonths <= 24) return 0
    if (horizonMonths <= 60) return 1
    if (horizonMonths <= 120) return 3
    return 7
  }, [horizonMonths])

  const hasRetirement = Number(goalTarget) > 0
  const hasMilestone = Number(milestoneTarget) > 0

  return (
    <Card className="p-6 relative overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/60 dark:text-white/30">
            Projection
          </div>
          <div className="mt-2 flex items-center gap-2">
            <TrendingUp size={18} className="text-ink-muted/70 dark:text-white/35" />
            <div className="text-lg font-semibold text-ink dark:text-white">Net worth projection</div>
          </div>
          <div className="mt-1 text-sm text-ink-muted/70 dark:text-white/35">
            Baseline vs your simulated changes.
          </div>
        </div>

        <span className="shrink-0 text-[10px] font-medium tracking-wider uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Pro
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {OPTIONS.map((opt) => {
          const active = horizon === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (!isPro) return setPage?.('upgrade')
                setHorizon(opt.id)
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                active
                  ? 'bg-black/[.04] dark:bg-white/[.08] border-black/[.06] dark:border-white/[.08] text-ink dark:text-white'
                  : 'bg-transparent border-black/[.06] dark:border-white/[.06] text-ink-muted dark:text-white/35 hover:bg-black/[.03] dark:hover:bg-white/[.05]'
              } ${!isPro ? 'opacity-70' : ''}`}
            >
              {opt.label}
              {!isPro ? ' 🔒' : ''}
            </button>
          )
        })}
      </div>

      {!canChart ? (
        <div className="mt-5 rounded-2xl bg-black/[.03] dark:bg-white/[.04] p-4 text-sm text-ink-muted/70 dark:text-white/35">
          Add at least one account included in net worth to see projections.
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[.03] dark:bg-white/[.05] text-ink-muted dark:text-white/35">
              <span className="w-2 h-2 rounded-full" style={{ background: baselineStroke }} />
              Baseline
            </span>

            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[.03] dark:bg-white/[.05] text-ink-muted dark:text-white/35">
              <span className="w-2 h-2 rounded-full" style={{ background: simStroke }} />
              Simulated
            </span>

            {hasRetirement && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[.03] dark:bg-white/[.05] text-ink-muted dark:text-white/35">
                <span className="w-2 h-2 rounded-full" style={{ background: retirementStroke }} />
                {goalName || 'Retirement'} target
              </span>
            )}

            {hasMilestone && (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[.03] dark:bg-white/[.05] text-ink-muted dark:text-white/35">
                <span className="w-2 h-2 rounded-full" style={{ background: milestoneStroke }} />
                Next milestone
              </span>
            )}
          </div>

          <div className="mt-4 relative">
            <div className={`transition-opacity ${chartOpacity}`}>
              <SafeChart
                data={series}
                xInterval={xInterval}
                baseCurrency={baseCurrency}
                baselineStroke={baselineStroke}
                simStroke={simStroke}
                retirementStroke={retirementStroke}
                milestoneStroke={milestoneStroke}
                goalTarget={goalTarget}
                milestoneTarget={milestoneTarget}
                hasRetirement={hasRetirement}
                hasMilestone={hasMilestone}
              />
            </div>

            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <UpgradeButton onClick={() => setPage?.('upgrade')} icon={Lock} size="md">
                  Unlock projections
                </UpgradeButton>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-black/[.03] dark:bg-white/[.04] p-4">
              <div className="text-[11px] text-ink-muted/60 dark:text-white/30">Now</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-ink dark:text-white">
                {isPro ? currencyFmt(startBase, baseCurrency) : '—'}
              </div>
            </div>

            <div className="rounded-2xl bg-black/[.03] dark:bg-white/[.04] p-4">
              <div className="text-[11px] text-ink-muted/60 dark:text-white/30">Baseline</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-ink dark:text-white">
                {isPro ? currencyFmt(endBase, baseCurrency) : '—'}
              </div>
            </div>

            <div className="rounded-2xl bg-black/[.03] dark:bg-white/[.04] p-4">
              <div className="text-[11px] text-ink-muted/60 dark:text-white/30">Simulated</div>
              <div className="mt-1 text-sm font-semibold tabular-nums text-ink dark:text-white">
                {isPro ? currencyFmt(endSim, baseCurrency) : '—'}
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}