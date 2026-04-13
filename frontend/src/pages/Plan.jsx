// frontend/src/pages/Plan.jsx
// 3-layer composition: Stage → Scenarios → Decisions handoff.
// Interpretation sentence first, then evidence (chart), then exploration, then exit.

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import { useApp } from '../App'
import { track } from '../track'
import GoalSetup from './GoalSetup'
import { fmtCurrency, fmtCurrencyCompact } from '../utils'
import WealthTooltip from '../components/charts/WealthTooltip'
import {
  xAxisProps, yAxisProps, gridProps, tooltipProps,
  compactTickFormatter, chartMargin, ACCENT_STROKE, activeDotStyle,
} from '../components/charts/chartTheme'
import ScenarioCompareCard from '../components/outlook/ScenarioCompareCard'
import DrawdownPlannerCard from '../components/outlook/DrawdownPlannerCard'
import EditPlanModal from '../components/outlook/EditPlanModal'
import PlanHeroDashboard from '../components/outlook/PlanHeroDashboard'
import useScenarioCompare from '../hooks/outlook/useScenarioCompare'
import useOutlookForecast from '../hooks/outlook/useOutlookForecast'
import useDrawdownPlanner from '../hooks/outlook/useDrawdownPlanner'
import {
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ChevronRight,
  Shield,
  Landmark,
  X,
} from 'lucide-react'

const INFLATION_RATE = 0.025

function numFrom(input, fallback = 0) {
  const n = Number(String(input ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}


function DecisionsHandoff({ onOpen }) {
  return (
    <button type="button" onClick={onOpen} className="w-full text-left group">
      <div
        className="relative overflow-hidden px-8 py-7 rounded-3xl hover:opacity-95 transition-opacity"
        style={{
          background: 'linear-gradient(135deg, #141A26 0%, #1A2030 55%, #141A26 100%)',
          border: '1px solid rgba(212,175,55,0.18)',
        }}
      >
        <div aria-hidden="true" className="absolute -top-14 -right-10 w-[260px] h-[260px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.10) 0%, transparent 65%)' }} />
        <div className="relative flex items-center justify-between gap-8">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-[.18em] uppercase mb-2" style={{ color: 'var(--gold)' }}>
              Next step
            </div>
            <div className="text-[17px] font-semibold text-white leading-snug">
              Where should the next pounds go?
            </div>
            <div className="mt-1.5 text-sm leading-relaxed max-w-[40rem]" style={{ color: 'rgba(255,255,255,0.38)' }}>
              ISA room, mortgage trade-offs, pension top-ups — modelled before you commit.
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2 text-sm font-semibold opacity-65 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--gold)' }}>
            Decisions <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </button>
  )
}

/* ── PlanSentence ───────────────────────────────────── */
/* Declarative interpretation — placed first in Scene 1  */
/* before PlanHeroDashboard. Tells the user what their   */
/* situation means before asking them to read a chart.   */

function PlanSentence({ derived, ccy }) {
  const { status, displayProjEnd, targetAmt, absGap, gap, deltaMc, goal, freedomYearNum, yearsToGoal } = derived

  if (!targetAmt || targetAmt <= 0) return null

  const targetAge = goal?.target_age
  const projFormatted   = fmtCurrencyCompact(displayProjEnd, ccy)
  const targetFormatted = fmtCurrencyCompact(targetAmt, ccy)
  const gapFormatted    = fmtCurrencyCompact(absGap, ccy)

  // Build a human-readable "N years from now" label when the goal hit-date is known.
  const yearsRounded = yearsToGoal != null ? Math.round(yearsToGoal) : null
  const yearsLabel = yearsRounded != null
    ? yearsRounded < 1 ? 'less than a year from now'
    : yearsRounded === 1 ? 'about a year from now'
    : `about ${yearsRounded} years from now`
    : null

  let headline = ''
  let freedomLine = null
  let lever = ''

  if (status === 'ahead') {
    headline = targetAge
      ? `Projecting ${projFormatted} by age ${targetAge} — ${gapFormatted} ahead of your ${targetFormatted} target.`
      : `You're ${gapFormatted} ahead of your ${targetFormatted} target.`
    if (freedomYearNum != null && yearsLabel) {
      freedomLine = `At this pace, you reach your target in ${freedomYearNum} — ${yearsLabel}.`
    }
    lever = 'Maintain the current pace or redirect the surplus.'
  } else if (status === 'on_track') {
    headline = targetAge
      ? `At current pace, projecting ${projFormatted} by age ${targetAge} — on track for your ${targetFormatted} target.`
      : `You're on track to reach your ${targetFormatted} target.`
    if (freedomYearNum != null && yearsLabel) {
      freedomLine = `Your plan reaches the target in ${freedomYearNum} — ${yearsLabel}.`
    }
    lever = 'Consistency matters more than complexity from here.'
  } else {
    headline = targetAge
      ? `At this pace you'll reach ${projFormatted} by age ${targetAge} — ${gapFormatted} short of your ${targetFormatted} target.`
      : `Your current plan projects ${projFormatted}, leaving a ${gapFormatted} gap.`
    lever = deltaMc && deltaMc > 0
      ? `Adding ${fmtCurrency(deltaMc, ccy)}/month would close the gap.`
      : 'Increasing contributions is the clearest lever.'
  }

  return (
    <div className="mb-7 max-w-[52rem]">
      <p className="text-[19px] sm:text-[22px] font-semibold leading-snug" style={{ color: 'rgba(255,255,255,0.92)' }}>
        {headline}
      </p>
      {freedomLine && (
        <p className="mt-2 text-[16px] sm:text-[18px] font-medium leading-snug" style={{ color: 'rgba(255,255,255,0.68)' }}>
          {freedomLine}
        </p>
      )}
      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.40)' }}>
        {lever}
      </p>
    </div>
  )
}

export default function Plan() {
  const {
    baseCurrency, setPage, primaryGoal, showToast,
    loadPrimaryGoal, bumpData, isPro, settingsReady,
  } = useApp()

  const trackedViewRef = useRef(false)
  const [trajOpen, setTrajOpen] = useState(true)
  const [inflationAdj, setInflationAdj] = useState(false)
  const [scenarioCompareOpen, setScenarioCompareOpen] = useState(true)
  const [drawdownOpen, setDrawdownOpen] = useState(true)

  const [goalSetupOpen, setGoalSetupOpen] = useState(false)

  const deflate = useCallback(
    (value, yearsFromNow) => {
      if (!settingsReady) return value
      if (!inflationAdj || !isPro) return value
      return Number(value || 0) / Math.pow(1 + INFLATION_RATE, Number(yearsFromNow || 0))
    },
    [settingsReady, inflationAdj, isPro]
  )

  const goalId = primaryGoal?.id

  const goUpgrade = useCallback((source = 'plan_cta') => {
    track('upgrade_clicked', { page: 'plan', source })
    try { localStorage.setItem('upgrade_reason', source) } catch {}
    setPage('upgrade')
  }, [setPage])

  const openStrategy = useCallback(() => {
    track('decisions_opened', { source: 'plan_preview' })
    setPage('decisions')
  }, [setPage])

  const {
    forecast, loading, error,
    localContrib, setLocalContrib,
    localReturn, setLocalReturn,
    dirty, setDirty, feedback,
    editOpen, editSaving, editForm,
    openEdit, closeEdit, updateEdit, saveEditPlan,
    retryForecast, applyAssumptions,
    derived, chartData,
  } = useOutlookForecast({
    goalId, primaryGoal, baseCurrency,
    settingsReady, isPro, deflate, numFrom,
    showToast, loadPrimaryGoal, bumpData, track,
  })

  const {
    scenarios, scenariosLoading, compareLoading, compareCards,
    bestScenario, scenarioEditorOpen, scenarioSaving,
    editingScenarioId, scenarioForm, setScenarioForm,
    openNewScenario, openEditScenario, closeScenarioEditor,
    saveScenario, deleteScenario,
  } = useScenarioCompare({
    goalId, forecast, settingsReady, isPro,
    localContrib, localReturn, showToast,
    isActive: scenarioCompareOpen,
  })

  const drawdown = useDrawdownPlanner({ goal: derived.goal })

  useEffect(() => {
    if (trackedViewRef.current) return
    trackedViewRef.current = true
    track('page_view', { page: 'plan' })
  }, [])

  const statusLabels = {
    ahead: 'Ahead of plan',
    on_track: 'On track',
    adjust: 'Adjust to stay on track',
  }

  const statusColors = {
    ahead: 'text-emerald-600 dark:text-emerald-300/[0.8] bg-emerald-300/[.08] border border-emerald-300/[.12]',
    on_track: 'text-ink dark:text-white bg-black/[.04] dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.08]',
    adjust: 'text-red-400 dark:text-red-300/[0.6] bg-red-300/[.06] border border-red-300/[.12]',
  }

  const inp = 'w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const lbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2'
  const modalInp = 'w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark-2 text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const modalLbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-wide'

  const editValid =
    String(editForm.current_age || '').trim() &&
    String(editForm.target_age || '').trim() &&
    String(editForm.target_amount || '').trim()


    useEffect(() => {
      try {
        const shouldOpen = sessionStorage.getItem('paddock:open-goal-setup') === '1'
        if (shouldOpen && primaryGoal === null) {
          setGoalSetupOpen(true)
          sessionStorage.removeItem('paddock:open-goal-setup')
        }
      } catch {}
    }, [primaryGoal])  

  const trajectoryCompareData = useMemo(() => {
    if (!chartData?.length) return []
    if (compareLoading || !bestScenario?.forecast?.projected_points?.length) {
      return chartData.map((point) => ({ ...point, compareProjected: null }))
    }
    const bestPoints = bestScenario.forecast.projected_points
    const sampledBest = []
    for (let i = 0; i < bestPoints.length; i++) {
      if (i === 0 || i % 6 === 0 || i === bestPoints.length - 1) {
        const p = bestPoints[i]
        sampledBest.push({ date: p.date, compareProjected: deflate(p.value, i / 12) })
      }
    }
    const compareByDate = new Map(sampledBest.map((p) => [p.date, p.compareProjected]))
    return chartData.map((point) => ({
      ...point,
      compareProjected: compareByDate.get(point.date) ?? null,
    }))
  }, [chartData, bestScenario, compareLoading, deflate])

  const localContribNum = numFrom(localContrib, 0)
  const localReturnNum = numFrom(localReturn, 0)

  if (primaryGoal === undefined || loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-7 w-12 rounded-lg skeleton opacity-60" />
        <div className="-mx-4 sm:-mx-6 lg:-mx-8" style={{ background: '#141A26', minHeight: 320 }}>
          <div className="px-6 pt-9 pb-0 sm:px-10 space-y-5">
            <div className="h-3 w-28 rounded skeleton opacity-20" />
            <div className="h-10 w-56 rounded-lg skeleton opacity-22" />
            <div className="grid grid-cols-2 gap-8">
              {[1,2].map(i => <div key={i}><div className="h-2 w-24 rounded skeleton opacity-15 mb-3"/><div className="h-12 w-40 rounded-lg skeleton opacity-20"/></div>)}
            </div>
            <div className="h-1 w-full rounded-full skeleton opacity-15" />
          </div>
          <div className="h-[440px] w-full skeleton opacity-10 mt-6" />
        </div>
        <div className="h-40 rounded-3xl skeleton" />
      </div>
    )
  }


/* ── No goal state ── */
if (primaryGoal === null) {
  return (
    <div className="space-y-5 animate-page-in">
      <h1 className="text-sm font-semibold tracking-[.08em] uppercase text-ink-muted/40 dark:text-white/22">
        Plan
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

        <div className="relative px-6 pt-9 pb-9 sm:px-10 sm:pt-10 sm:pb-10">
          <div className="max-w-[42rem]">
            <div
              className="text-[10px] font-semibold tracking-[.18em] uppercase mb-4"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              Plan
            </div>

            <h2 className="text-[28px] sm:text-[34px] font-bold text-white tracking-tight leading-tight">
              Set your target
            </h2>

            <p
              className="mt-3 text-sm leading-relaxed max-w-[34rem]"
              style={{ color: 'rgba(255,255,255,0.42)' }}
            >
              Add a long-term goal to see your projected path, gap to target, and when your plan becomes achievable.
            </p>

            <div className="mt-6">
              <button
                onClick={() => setGoalSetupOpen((v) => !v)}
                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-2xl transition-colors"
                style={{ background: 'var(--gold)', color: '#0A0F1A' }}
                type="button"
              >
                {goalSetupOpen ? 'Hide goal setup' : 'Set up goal'}
                <ChevronRight
                  size={14}
                  className={`transition-transform duration-200 ${goalSetupOpen ? 'rotate-90' : ''}`}
                />
              </button>
            </div>
          </div>

          <div
            className={[
              'transition-all duration-300 ease-out overflow-hidden',
              goalSetupOpen ? 'max-h-[1400px] opacity-100 mt-8' : 'max-h-0 opacity-0 mt-0',
            ].join(' ')}
          >
            <div className="max-w-[760px]">
              <div
                className="rounded-[28px] overflow-hidden border border-white/[.08]"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              >
                <GoalSetup
                  embedded
                  onComplete={() => {
                    bumpData?.()
                    setGoalSetupOpen(false)
                  }}
                />
              </div>
            </div>
          </div>

          {!goalSetupOpen && (
            <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    icon: Shield,
                    title: 'Projected path',
                    body: 'See where your current pace leads over time.',
                  },
                  {
                    icon: Landmark,
                    title: 'Gap to target',
                    body: 'Understand how far you are from your goal.',
                  },
                  {
                    icon: Sparkles,
                    title: 'Freedom timeline',
                    body: 'See when your plan becomes achievable.',
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
          )}
        </div>
      </div>
    </div>
  )
}


  if (error && !forecast) {
    return (
      <div className="space-y-5">
        <h1 className="text-sm font-semibold tracking-[.08em] uppercase text-ink-muted/40 dark:text-white/22">Plan</h1>
        <div className="rounded-3xl border border-black/[.06] dark:border-white/[.07] bg-white dark:bg-surface-dark-2 p-8 text-center">
          <AlertTriangle size={28} className="text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-ink dark:text-white mb-1">Unable to load plan</p>
          <p className="text-xs text-ink-muted/50 dark:text-white/25 mb-5">{error}</p>
          <button onClick={retryForecast}
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors" type="button">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    )
  }

  const goal = derived.goal
  const ccy = derived.ccy
  const status = derived.status

  return (
    <div className="space-y-5 animate-page-in">

      <h1 className="text-sm font-semibold tracking-[.08em] uppercase text-ink-muted/40 dark:text-white/22">Plan</h1>

      {error && forecast ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle size={15} />
          <span>Plan may be outdated. <button onClick={retryForecast} className="underline font-medium" type="button">Retry</button></span>
        </div>
      ) : null}

      {/* ── SCENE 1: The Stage ── */}
      <div
        className="-mx-4 sm:-mx-6 lg:-mx-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(170deg, #0A0F1A 0%, #141A26 40%, #0F141F 100%)' }}
      >
        <div aria-hidden="true" className="absolute -top-32 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.05) 0%, transparent 60%)' }} />
        <div aria-hidden="true" className="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(120,169,230,0.06) 0%, transparent 60%)' }} />

        {/* Hero content */}
        <div className="relative px-6 pt-9 pb-8 sm:px-10 sm:pt-10">
          {/* Declarative sentence — first meaningful content on Plan */}
          {forecast && settingsReady && (
            <PlanSentence derived={derived} ccy={ccy} />
          )}
          <PlanHeroDashboard
            goal={goal} derived={derived} ccy={ccy} status={status}
            statusLabels={statusLabels} statusColors={statusColors}
            isPro={isPro} settingsReady={settingsReady}
            inflationAdj={inflationAdj} setInflationAdj={setInflationAdj}
            openEdit={openEdit} goUpgrade={goUpgrade}
            localContrib={localContrib} localReturn={localReturn} feedback={feedback}
          />
        </div>

        {/* Chart zone */}
        <div className="relative" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-6 pt-6 pb-0 sm:px-10 flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-[2px] rounded-full inline-block bg-accent" /> Current plan
              </span>
              {!compareLoading && bestScenario && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-[2px] rounded-full inline-block bg-emerald-500" />
                  {bestScenario.name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-[2px] rounded-full inline-block" style={{ background: 'rgba(255,255,255,0.28)' }} />
                Required pace
              </span>
              <span className="inline-flex items-center gap-1.5">
              <span
  className="w-4 h-[2px] inline-block"
  style={{
    background: '#C89B3C',
    opacity: 0.82,
    borderRadius: 9999,
  }}
/>
                Target
              </span>
            </div>
            <button type="button" onClick={() => setTrajOpen((v) => !v)}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold transition-colors"
              style={{ color: 'rgba(255,255,255,0.30)' }}>
              {trajOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {trajOpen ? 'Hide' : 'Show'}
            </button>
          </div>

          {!compareLoading && bestScenario && (
            <div className="px-6 pt-4 sm:px-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.42)' }}>
                <Sparkles size={10} style={{ opacity: 0.6 }} />
                vs <span style={{ color: 'rgba(255,255,255,0.62)' }}>{bestScenario.name}</span>
              </div>
            </div>
          )}

          {trajOpen ? (
            trajectoryCompareData.length > 1 ? (
              <div className="mt-5 px-3 sm:px-4">
                <div className="h-[420px] sm:h-[500px] lg:h-[540px]">
                  <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trajectoryCompareData} margin={chartMargin}>
  <defs>
    <linearGradient id="planTrajFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={ACCENT_STROKE} stopOpacity={0.26} />
      <stop offset="55%" stopColor={ACCENT_STROKE} stopOpacity={0.10} />
      <stop offset="100%" stopColor={ACCENT_STROKE} stopOpacity={0} />
    </linearGradient>
  </defs>

  <CartesianGrid
    {...gridProps}
    vertical={false}
    strokeOpacity={0.08}
  />

  <XAxis
    dataKey="date"
    {...xAxisProps}
    tickFormatter={(d) =>
      new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    }
  />

  <YAxis
    {...yAxisProps}
    tickFormatter={compactTickFormatter}
  />

  <Tooltip content={<WealthTooltip currency={ccy} />} {...tooltipProps} />

  <ReferenceLine
    y={derived.displayTarget}
    stroke="#C89B3C"
    strokeWidth={1.75}
    strokeDasharray="4 4"
    strokeOpacity={0.82}
  />

  <Area
    type="monotone"
    dataKey="required"
    name="Required pace"
    stroke="rgba(255,255,255,0.28)"
    strokeWidth={1.75}
    strokeDasharray="5 5"
    fill="none"
    dot={false}
    connectNulls
    isAnimationActive={false}
  />

  {!compareLoading && bestScenario && (
    <Area
      type="monotone"
      dataKey="compareProjected"
      name="Best scenario"
      stroke="#2FA676"
      strokeWidth={2.1}
      strokeDasharray="7 5"
      strokeOpacity={0.72}
      fill="none"
      dot={false}
      connectNulls
      isAnimationActive={false}
    />
  )}

  <Area
    type="monotone"
    dataKey="projected"
    name="Current plan"
    stroke={ACCENT_STROKE}
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="url(#planTrajFill)"
    dot={false}
    activeDot={activeDotStyle}
    isAnimationActive={false}
  />
</AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="mx-6 mt-5 sm:mx-10 h-[220px] flex items-center justify-center text-sm rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.28)' }}>
                Add accounts to see your trajectory
              </div>
            )
          ) : <div className="pb-2" />}
        </div>

        {/* Assumptions zone */}
        {trajOpen && (
          <div className="px-6 pt-7 pb-6 sm:px-10" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] font-semibold tracking-[.18em] uppercase mb-5" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Assumptions
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.40)' }}>
                  Monthly contribution ({ccy})
                </label>
                <input value={localContrib} onChange={(e) => { setLocalContrib(e.target.value); setDirty(true) }}
                  className="w-full px-4 py-3 rounded-2xl text-base focus:outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)', color: 'white' }}
                  inputMode="decimal" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.40)' }}>
                  Annual return (%)
                </label>
                <div className="flex items-center gap-2">
                  <input value={localReturn} onChange={(e) => { setLocalReturn(e.target.value); setDirty(true) }}
                    className="flex-1 min-w-0 px-4 py-3 rounded-2xl text-base focus:outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)', color: 'white' }}
                    inputMode="decimal" />
                  <div className="flex gap-1.5 shrink-0">
                    {[{label:'3%',value:3},{label:'5%',value:5},{label:'7%',value:7}].map((s) => (
                      <button key={s.value} type="button" onClick={() => { setLocalReturn(String(s.value)); setDirty(true) }}
                        className="text-[11px] font-semibold px-2.5 py-2 rounded-xl transition-colors"
                        style={Number(localReturn) === s.value
                          ? { background: 'rgba(120,169,230,0.35)', border: '1px solid rgba(120,169,230,0.45)', color: 'rgba(243,245,247,0.92)' }
                          : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.35)' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {dirty && (
                <div>
                  <button type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); applyAssumptions() }}
                    className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-2xl text-sm font-semibold transition-opacity"
                    style={{ background: 'var(--gold)', color: '#0A0F1A', opacity: loading ? 0.6 : 1 }}
                    disabled={loading}>
                    {loading ? 'Updating…' : 'Update projection'}
                  </button>
                </div>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.20)' }}>
              {fmtCurrency(localContribNum, ccy)}/month at {localReturnNum}% annual growth, compounded monthly.
            </p>
          </div>
        )}

      </div>

      {/* ── SCENE 2: Scenarios ── */}
      <div className="-mt-1">
        <ScenarioCompareCard
          settingsReady={settingsReady} isPro={isPro} ccy={ccy}
          scenarios={scenarios} compareCards={compareCards} bestScenario={bestScenario}
          scenariosLoading={scenariosLoading} compareLoading={compareLoading}
          scenarioEditorOpen={scenarioEditorOpen} editingScenarioId={editingScenarioId}
          scenarioForm={scenarioForm} setScenarioForm={setScenarioForm}
          scenarioSaving={scenarioSaving}
          onAdd={openNewScenario} onEdit={openEditScenario} onDelete={deleteScenario}
          onCloseEditor={closeScenarioEditor} onSaveScenario={saveScenario}
          onUpgrade={() => goUpgrade('scenario_compare_locked')}
          isOpen={scenarioCompareOpen} onToggleOpen={() => setScenarioCompareOpen((v) => !v)}
        />
      </div>

      {/* ── SCENE 2B: Drawdown Planner ── */}
      <DrawdownPlannerCard
        ccy={ccy}
        drawdown={drawdown}
        isOpen={drawdownOpen}
        onToggleOpen={() => setDrawdownOpen((v) => !v)}
      />

      {/* ── SCENE 3: Decisions handoff ── */}
      <DecisionsHandoff onOpen={openStrategy} />

      <EditPlanModal
        open={editOpen} editForm={editForm} updateEdit={updateEdit}
        editValid={editValid} editSaving={editSaving}
        onClose={closeEdit} onSave={saveEditPlan}
        modalInp={modalInp} modalLbl={modalLbl} ccy={ccy}
      />
    </div>
  )
}