import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import { track } from '../track'
import ScenarioCompareCard from '../components/outlook/ScenarioCompareCard'
import EditPlanModal from '../components/outlook/EditPlanModal'
import AccountProjectionsCard from '../components/outlook/AccountProjectionsCard'
import OutlookTrajectoryCard from '../components/outlook/OutlookTrajectoryCard'
import PlanPriorityCard from '../components/outlook/PlanPriorityCard'
import PlanReviewCard from '../components/outlook/PlanReviewCard'
import PlanHeroDashboard from '../components/outlook/PlanHeroDashboard'
import PlanStrategyPreviewCard from '../components/outlook/PlanStrategyPreviewCard'
import useScenarioCompare from '../hooks/outlook/useScenarioCompare'
import useProjectionData from '../hooks/outlook/useProjectionData'
import useOutlookForecast from '../hooks/outlook/useOutlookForecast'
import { AlertTriangle, RefreshCw } from 'lucide-react'

const INFLATION_RATE = 0.025

function numFrom(input, fallback = 0) {
  const n = Number(String(input ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
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

  const trackedViewRef = useRef(false)

  const [trajOpen, setTrajOpen] = useState(true)
  const [projOpen, setProjOpen] = useState(false)
  const [inflationAdj, setInflationAdj] = useState(false)
  const [scenarioCompareOpen, setScenarioCompareOpen] = useState(true)

  const deflate = useCallback(
    (value, yearsFromNow) => {
      if (!settingsReady) return value
      if (!inflationAdj || !isPro) return value
      return Number(value || 0) / Math.pow(1 + INFLATION_RATE, Number(yearsFromNow || 0))
    },
    [settingsReady, inflationAdj, isPro]
  )

  const goalId = primaryGoal?.id

  const goUpgrade = useCallback(
    (source = 'outlook_cta') => {
      track('upgrade_clicked', {
        page: 'outlook',
        source,
      })

      try {
        localStorage.setItem('upgrade_reason', source)
      } catch {}

      setPage('upgrade')
    },
    [setPage]
  )

  const openStrategy = useCallback(() => {
    track('strategy_opened', {
      source: 'outlook_preview',
    })
    setPage('strategy')
  }, [setPage])

  const {
    forecast,
    loading,
    error,
    localContrib,
    setLocalContrib,
    localReturn,
    setLocalReturn,
    dirty,
    setDirty,
    feedback,
    editOpen,
    editSaving,
    editForm,
    openEdit,
    closeEdit,
    updateEdit,
    saveEditPlan,
    retryForecast,
    applyAssumptions,
    derived,
    chartData,
  } = useOutlookForecast({
    goalId,
    primaryGoal,
    baseCurrency,
    settingsReady,
    isPro,
    deflate,
    numFrom,
    showToast,
    loadPrimaryGoal,
    bumpData,
    track,
  })

  const {
    scenarios,
    scenariosLoading,
    compareLoading,
    compareCards,
    bestScenario,
    scenarioEditorOpen,
    scenarioSaving,
    editingScenarioId,
    scenarioForm,
    setScenarioForm,
    openNewScenario,
    openEditScenario,
    closeScenarioEditor,
    saveScenario,
    deleteScenario,
  } = useScenarioCompare({
    goalId,
    forecast,
    settingsReady,
    isPro,
    localContrib,
    localReturn,
    showToast,
    isActive: scenarioCompareOpen,
  })

  const {
    projData,
    setProjYears,
    projLoading,
    HORIZONS,
    effectiveProjYears,
    projChartData,
    filteredMilestones,
  } = useProjectionData({
    settingsReady,
    isPro,
    projOpen,
    deflate,
  })

  useEffect(() => {
    if (trackedViewRef.current) return
    trackedViewRef.current = true

    track('page_view', { page: 'outlook' })
  }, [])

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

  const inp =
    'w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const lbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2'
  const modalInp =
    'w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark-2 text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const modalLbl =
    'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-wide'

  const editValid =
    String(editForm.current_age || '').trim() &&
    String(editForm.target_age || '').trim() &&
    String(editForm.target_amount || '').trim()

  const trajectoryCompareData = useMemo(() => {
    if (!chartData?.length) return []

    if (compareLoading || !bestScenario?.forecast?.projected_points?.length) {
      return chartData.map((point) => ({
        ...point,
        compareProjected: null,
      }))
    }

    const bestPoints = bestScenario.forecast.projected_points

    const sampledBest = []
    for (let i = 0; i < bestPoints.length; i++) {
      if (i === 0 || i % 6 === 0 || i === bestPoints.length - 1) {
        const p = bestPoints[i]
        const yearsOut = i / 12
        sampledBest.push({
          date: p.date,
          compareProjected: deflate(p.value, yearsOut),
        })
      }
    }

    const compareByDate = new Map(sampledBest.map((p) => [p.date, p.compareProjected]))

    return chartData.map((point) => ({
      ...point,
      compareProjected: compareByDate.get(point.date) ?? null,
    }))
  }, [chartData, bestScenario, compareLoading, deflate])

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
          Plan
        </h1>
        <Card className="p-10 text-center">
          <p className="text-ink-muted dark:text-white/40 mb-4">
            Set a primary goal to unlock your planning centre.
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
          Plan
        </h1>
        <Card className="p-8 text-center">
          <AlertTriangle size={32} className="text-amber-500 mx-auto mb-4" />
          <p className="text-sm text-ink-muted dark:text-white/50 mb-2">Unable to load plan</p>
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
      {error && forecast ? (
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle size={16} />
          <span>
            Plan may be outdated.{' '}
            <button onClick={retryForecast} className="underline font-medium" type="button">
              Retry
            </button>
          </span>
        </div>
      ) : null}

      <PlanHeroDashboard
        goal={goal}
        derived={derived}
        ccy={ccy}
        status={status}
        statusLabels={statusLabels}
        statusColors={statusColors}
        isPro={isPro}
        settingsReady={settingsReady}
        inflationAdj={inflationAdj}
        setInflationAdj={setInflationAdj}
        openEdit={openEdit}
        goUpgrade={goUpgrade}
        localContrib={localContrib}
        localReturn={localReturn}
        feedback={feedback}
      />

      <PlanPriorityCard
        status={status}
        derived={derived}
        ccy={ccy}
        isPro={isPro}
        settingsReady={settingsReady}
        localContrib={localContrib}
        setLocalContrib={setLocalContrib}
        setDirty={setDirty}
        applyAssumptions={applyAssumptions}
        goUpgrade={goUpgrade}
      />

      <ScenarioCompareCard
        settingsReady={settingsReady}
        isPro={isPro}
        ccy={ccy}
        scenarios={scenarios}
        compareCards={compareCards}
        bestScenario={bestScenario}
        scenariosLoading={scenariosLoading}
        compareLoading={compareLoading}
        scenarioEditorOpen={scenarioEditorOpen}
        editingScenarioId={editingScenarioId}
        scenarioForm={scenarioForm}
        setScenarioForm={setScenarioForm}
        scenarioSaving={scenarioSaving}
        onAdd={openNewScenario}
        onEdit={openEditScenario}
        onDelete={deleteScenario}
        onCloseEditor={closeScenarioEditor}
        onSaveScenario={saveScenario}
        onUpgrade={() => goUpgrade('scenario_compare_locked')}
        isOpen={scenarioCompareOpen}
        onToggleOpen={() => setScenarioCompareOpen((v) => !v)}
      />

      <OutlookTrajectoryCard
        trajOpen={trajOpen}
        setTrajOpen={setTrajOpen}
        chartData={trajectoryCompareData}
        derived={derived}
        ccy={ccy}
        lbl={lbl}
        inp={inp}
        localContrib={localContrib}
        setLocalContrib={setLocalContrib}
        localReturn={localReturn}
        setLocalReturn={setLocalReturn}
        dirty={dirty}
        setDirty={setDirty}
        loading={loading}
        applyAssumptions={applyAssumptions}
        bestScenario={bestScenario}
        compareLoading={compareLoading}
      />

      <AccountProjectionsCard
        projOpen={projOpen}
        setProjOpen={setProjOpen}
        settingsReady={settingsReady}
        isPro={isPro}
        HORIZONS={HORIZONS}
        effectiveProjYears={effectiveProjYears}
        setProjYears={setProjYears}
        goUpgrade={goUpgrade}
        projLoading={projLoading}
        projData={projData}
        filteredMilestones={filteredMilestones}
        deflate={deflate}
        ccy={ccy}
        projChartData={projChartData}
      />

      <PlanStrategyPreviewCard
        goalId={goalId}
        goal={goal}
        derived={derived}
        status={status}
        localContrib={localContrib}
        onOpenStrategy={openStrategy}
      />

      <PlanReviewCard
        derived={derived}
        ccy={ccy}
        isPro={isPro}
        settingsReady={settingsReady}
        localContrib={localContrib}
        localReturn={localReturn}
        goUpgrade={goUpgrade}
      />

      <EditPlanModal
        open={editOpen}
        editForm={editForm}
        updateEdit={updateEdit}
        editValid={editValid}
        editSaving={editSaving}
        onClose={closeEdit}
        onSave={saveEditPlan}
        modalInp={modalInp}
        modalLbl={modalLbl}
        ccy={ccy}
      />
    </div>
  )
}