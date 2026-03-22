import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import ProPreview from '../components/ProPreview'
import { track } from '../track'
import { ArrowRight, TrendingUp, Lightbulb, Award, Lock } from 'lucide-react'
import WhatIfCard from './WhatIfCard'
import ProProjectionCard from './ProProjectionCard'

const CATEGORY_ICONS = {
  progress: TrendingUp,
  discipline: Award,
  opportunity: Lightbulb,
}

const CATEGORY_LABELS = {
  progress: 'Progress',
  discipline: 'Discipline',
  opportunity: 'Opportunity',
}

const TONE_STYLES = {
  positive: 'border-l-gain/35 dark:border-l-gain/30',
  neutral: 'border-l-accent/25 dark:border-l-accent/22',
  warning: 'border-l-loss/28 dark:border-l-loss/24',
}

const MILESTONE_LADDER = [
  1_000, 2_500, 5_000, 10_000,
  25_000, 50_000, 100_000, 250_000, 500_000,
  750_000, 1_000_000,
  1_500_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000,
]

function getNextMilestone(total) {
  const t = Number(total || 0)
  const next = MILESTONE_LADDER.find((x) => x > t)
  return next || MILESTONE_LADDER[MILESTONE_LADDER.length - 1]
}

function fmtGBP(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `£${Math.round(v).toLocaleString()}`
}

export default function Insights() {
  const { setPage, isPro, primaryGoal, showToast } = useApp()

  const recordingRef = useRef(false)
  const trackedViewRef = useRef(false)

  const [data, setData] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)

  const [simulation, setSimulation] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [insightsRes, accountsRes, dashboardRes] = await Promise.all([
        api('/insights'),
        api('/accounts'),
        api('/dashboard?range=3M'),
      ])

      setData(insightsRes || {})
      setAccounts(Array.isArray(accountsRes) ? accountsRes : [])
      setDashboard(dashboardRes || null)
    } catch (e) {
      // Silently handled — loading state shows empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (trackedViewRef.current) return
    trackedViewRef.current = true

    track('page_view', { page: 'insights' })
    track('insights_viewed', { page: 'insights' })
  }, [])

  const insights = data?.insights || []
  const visibleInsights = isPro ? insights : insights.slice(0, 2)
  const lockedCount = Math.max(0, insights.length - visibleInsights.length)

  const groups = {}
  for (const ins of visibleInsights) {
    const cat = ins?.category || 'progress'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(ins)
  }
  const categoryOrder = ['progress', 'discipline', 'opportunity']

  const retirementTarget =
    primaryGoal?.target_amount ??
    primaryGoal?.targetAmount ??
    primaryGoal?.target ??
    null

  const total = Number(dashboard?.current_total || 0)

  const savedMilestoneTarget =
    Number(dashboard?.goal || 0) > 0
      ? Number(dashboard.goal)
      : (Number(data?.settings?.goal || 0) || 0)

  const hasSavedMilestone = savedMilestoneTarget > 0
  const milestoneAchieved = hasSavedMilestone && total > 0 && total >= savedMilestoneTarget
  const suggestedNext = getNextMilestone(total)

  const activeMilestoneTarget =
    hasSavedMilestone && !milestoneAchieved ? savedMilestoneTarget : suggestedNext

  const milestoneTarget =
    Number(activeMilestoneTarget || 0) > 0 ? Number(activeMilestoneTarget) : null

  if (loading) {
    return (
      <div className="space-y-7 animate-fade-in">
        <div>
          <div className="h-9 w-32 rounded-lg skeleton" />
          <div className="h-4 w-48 rounded skeleton mt-2" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl p-5 border border-black/[.04] dark:border-white/[.05] bg-white dark:bg-surface-dark-2">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-36 rounded skeleton" />
                <div className="h-3 w-56 rounded skeleton" />
              </div>
              <div className="h-8 w-16 rounded-lg skeleton" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
          Insights
        </h1>
        <p className="text-sm text-ink-muted dark:text-white/35 mt-1.5">
          Based on your plan and progress.
        </p>
      </div>

      <div className="text-xs text-ink-muted/60 dark:text-white/30">
        Modelling against your next milestone:{' '}
        <span className="text-ink dark:text-white font-semibold tabular-nums">
          {milestoneTarget ? fmtGBP(milestoneTarget) : '—'}
        </span>
      </div>

      <WhatIfCard
        goalTarget={milestoneTarget}
        accounts={accounts}
        onSimulationChange={setSimulation}
      />

      <ProProjectionCard
        accounts={accounts}
        goalTarget={retirementTarget}
        goalName={primaryGoal?.name || 'Retirement'}
        milestoneTarget={milestoneTarget}
        simulation={simulation}
      />

      {visibleInsights.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-5xl mb-5 opacity-20">💡</div>
          <p className="text-ink-muted dark:text-white/45 mb-2">No insights yet</p>
          <p className="text-sm text-ink-muted/50 dark:text-white/25">
            Add accounts and record your net worth to start seeing insights.
          </p>
        </Card>
      ) : (
        categoryOrder.map((cat) => {
          const items = groups[cat]
          if (!items || items.length === 0) return null
          const Icon = CATEGORY_ICONS[cat] || Lightbulb

          return (
            <div key={cat} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-tightish text-ink-muted dark:text-white/35">
                <Icon size={14} className="opacity-85" />
                {CATEGORY_LABELS[cat] || cat}
              </div>

              {items.map((ins, i) => (
                <Card
                  key={`${cat}-${i}`}
                  className={[
                    'p-6 border-l-[3px]',
                    TONE_STYLES[ins?.tone] || TONE_STYLES.neutral,
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-ink dark:text-white mb-1.5">
                        {ins.title}
                      </h3>
                      <p className="text-sm text-ink-muted dark:text-white/45 leading-relaxed">
                        {ins.body}
                      </p>
                    </div>

                    {ins.action === 'strategy' && (
                      <button
                        onClick={() => setPage('plan')}
                        className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-dark transition-colors whitespace-nowrap mt-1"
                        type="button"
                      >
                        View in Plan <ArrowRight size={13} className="opacity-85" />
                      </button>
                    )}

                    {ins.action === 'record' && (
                      <button
                        onClick={async () => {
                          if (recordingRef.current) return
                          recordingRef.current = true
                          try {
                            await api('/snapshots', { method: 'POST' })
                            showToast?.('Snapshot recorded')
                            load()
                          } catch (e) {
                            showToast?.(e?.message || 'Failed to record snapshot', 'error')
                          } finally {
                            recordingRef.current = false
                          }
                        }}
                        className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-dark transition-colors whitespace-nowrap mt-1"
                        type="button"
                      >
                        Record now <ArrowRight size={13} className="opacity-85" />
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )
        })
      )}

      {!isPro && lockedCount > 0 && (
        <ProPreview
          title={`${lockedCount} more insight${lockedCount > 1 ? 's' : ''} available`}
          subtitle="Unlock deeper analysis of your wealth trajectory with Pro."
        >
          <div className="space-y-3">
            <Card className="p-6 border-l-[3px] border-l-emerald-400">
              <h3 className="text-sm font-semibold text-ink dark:text-white mb-1.5">
                Savings rate trending up
              </h3>
              <p className="text-sm text-ink-muted dark:text-white/45">
                Your net contributions have increased 12% over the last 3 months.
              </p>
            </Card>
            <Card className="p-6 border-l-[3px] border-l-blue-400">
              <h3 className="text-sm font-semibold text-ink dark:text-white mb-1.5">
                Currency diversification opportunity
              </h3>
              <p className="text-sm text-ink-muted dark:text-white/45">
                85% of your wealth is in a single currency. Consider diversifying.
              </p>
            </Card>
          </div>
        </ProPreview>
      )}
    </div>
  )
}