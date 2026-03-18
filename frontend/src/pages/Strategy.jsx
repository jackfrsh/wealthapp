import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import { track } from '../track'
import PlanIsaStrategyCard from '../components/outlook/PlanIsaStrategyCard'
import useOutlookForecast from '../hooks/outlook/useOutlookForecast'
import { AlertTriangle, RefreshCw } from 'lucide-react'

function numFrom(input, fallback = 0) {
  const n = Number(String(input ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function getIsaStorageKey(goalId) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()
  const startYear = month > 3 || (month === 3 && day >= 6) ? year : year - 1
  return `paddock:plan:isa:${goalId || 'default'}:${startYear}`
}

export default function Strategy() {
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
  const [isaUsedYtd, setIsaUsedYtd] = useState('')
  const [isaMonthly, setIsaMonthly] = useState('')

  const goalId = primaryGoal?.id
  const isaStorageKey = useMemo(() => getIsaStorageKey(goalId), [goalId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(isaStorageKey)
      if (!raw) {
        setIsaUsedYtd('')
        setIsaMonthly('')
        return
      }

      const parsed = JSON.parse(raw)
      setIsaUsedYtd(parsed.isaUsedYtd ?? '')
      setIsaMonthly(parsed.isaMonthly ?? '')
    } catch {
      setIsaUsedYtd('')
      setIsaMonthly('')
    }
  }, [isaStorageKey])

  useEffect(() => {
    try {
      localStorage.setItem(
        isaStorageKey,
        JSON.stringify({
          isaUsedYtd,
          isaMonthly,
        })
      )
    } catch {}
  }, [isaStorageKey, isaUsedYtd, isaMonthly])

  const deflate = useCallback((value) => Number(value || 0), [])

  const {
    forecast,
    loading,
    error,
    localContrib,
    derived,
    retryForecast,
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

  useEffect(() => {
    if (trackedViewRef.current) return
    trackedViewRef.current = true

    track('page_view', { page: 'strategy' })
  }, [])

  if (primaryGoal === undefined || loading) {
    return (
      <div className="space-y-7 animate-fade-in">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="h-9 w-36 rounded-lg skeleton" />
            <div className="h-4 w-72 rounded mt-3 skeleton" />
          </div>
          <div className="h-10 w-28 rounded-2xl skeleton" />
        </div>

        <div className="rounded-3xl p-6 border border-black/[.04] dark:border-white/[.05] bg-white dark:bg-surface-dark-2">
          <div className="space-y-4">
            <div className="h-5 w-40 rounded skeleton" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl skeleton" />
              ))}
            </div>
            <div className="h-64 rounded-2xl skeleton" />
          </div>
        </div>
      </div>
    )
  }

  if (primaryGoal === null) {
    return (
      <div className="space-y-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
              Strategy
            </h1>
            <p className="mt-2 text-sm text-ink-muted dark:text-white/40 max-w-[42rem]">
              Wrapper guidance and funding order for your current plan.
            </p>
          </div>
        </div>

        <Card className="p-10 text-center">
          <p className="text-ink-muted dark:text-white/40 mb-4">
            Set a primary goal to unlock strategy.
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

  if (error && !forecast) {
    return (
      <div className="space-y-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
              Strategy
            </h1>
            <p className="mt-2 text-sm text-ink-muted dark:text-white/40 max-w-[42rem]">
              Wrapper guidance and funding order for your current plan.
            </p>
          </div>

          <button
            onClick={() => setPage('outlook')}
            className="text-sm font-semibold px-4 py-2 rounded-2xl border border-black/[.06] dark:border-white/[.08] text-ink dark:text-white bg-white/70 dark:bg-white/[.05] hover:bg-white dark:hover:bg-white/[.08] transition-colors"
            type="button"
          >
            Back to plan
          </button>
        </div>

        <Card className="p-8 text-center">
          <AlertTriangle size={32} className="text-amber-500 mx-auto mb-4" />
          <p className="text-sm text-ink-muted dark:text-white/50 mb-2">Unable to load strategy</p>
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
  const status = derived.status

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
            Strategy
          </h1>
          <p className="mt-2 text-sm text-ink-muted dark:text-white/40 max-w-[42rem]">
            Wrapper guidance, ISA room, and funding order for the next pounds in your plan.
          </p>
        </div>

        <button
          onClick={() => setPage('outlook')}
          className="text-sm font-semibold px-4 py-2 rounded-2xl border border-black/[.06] dark:border-white/[.08] text-ink dark:text-white bg-white/70 dark:bg-white/[.05] hover:bg-white dark:hover:bg-white/[.08] transition-colors"
          type="button"
        >
          Back to plan
        </button>
      </div>

      {error && forecast ? (
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle size={16} />
          <span>
            Strategy may be outdated.{' '}
            <button onClick={retryForecast} className="underline font-medium" type="button">
              Retry
            </button>
          </span>
        </div>
      ) : null}

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
    </div>
  )
}