// frontend/src/pages/Insights.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
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
  positive: 'border-l-gain/40 dark:border-l-emerald-500/30',
  neutral: 'border-l-accent/30 dark:border-l-blue-400/20',
  warning: 'border-l-amber-500/40 dark:border-l-amber-400/30',
}

/* ──────────────────────────────────────────── */
/* Milestone ladder (match Home)                 */
/* ──────────────────────────────────────────── */

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

export default function Insights() {
  const { setPage, isPro, primaryGoal } = useApp()

  const [data, setData] = useState(null) // insights payload + settings
  const [accounts, setAccounts] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)

  // Simulation state pushed up from WhatIfCard
  const [simulation, setSimulation] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // ✅ Add /dashboard so Insights knows: current_total + goal (milestone)
      const [insightsRes, accountsRes, settingsRes, dashboardRes] = await Promise.all([
        api('/insights'),
        api('/accounts'),
        api('/settings'),
        api('/dashboard?range=3M'),
      ])

      setData({ ...(insightsRes || {}), settings: settingsRes || null })
      setAccounts(Array.isArray(accountsRes) ? accountsRes : [])
      setDashboard(dashboardRes || null)
    } catch (e) {
      console.error(e)
      // keep old UI behaviour: just stop loading; card will show empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const insights = data?.insights || []
  const visibleInsights = isPro ? insights : insights.slice(0, 2)
  const lockedCount = Math.max(0, insights.length - visibleInsights.length)

  // Group visible insights by category
  const groups = {}
  for (const ins of visibleInsights) {
    const cat = ins?.category || 'progress'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(ins)
  }
  const categoryOrder = ['progress', 'discipline', 'opportunity']

  // Retirement target (long-term): from primaryGoal
  const retirementTarget =
    primaryGoal?.target_amount ??
    primaryGoal?.targetAmount ??
    primaryGoal?.target ??
    null

  /* ──────────────────────────────────────────── */
  /* Milestone wiring (stable + premium)           */
  /* ──────────────────────────────────────────── */

  const total = Number(dashboard?.current_total || 0)

  // Prefer dashboard.goal (it’s the same setting, but always in one payload)
  const savedMilestoneTarget =
    Number(dashboard?.goal || 0) > 0
      ? Number(dashboard.goal)
      : (Number(data?.settings?.goal || 0) || 0)

  const hasSavedMilestone = savedMilestoneTarget > 0
  const milestoneAchieved = hasSavedMilestone && total > 0 && total >= savedMilestoneTarget

  const suggestedNext = getNextMilestone(total)

  // Active target used for modelling:
  // - if saved milestone exists and is not achieved -> use it
  // - otherwise use suggested next (so modelling always works)
  const activeMilestoneTarget =
    hasSavedMilestone && !milestoneAchieved ? savedMilestoneTarget : suggestedNext

  // This is what feeds WhatIf
  const milestoneTarget = Number(activeMilestoneTarget || 0) > 0 ? Number(activeMilestoneTarget) : null

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-48 rounded-lg skeleton" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[100px] rounded-2xl skeleton" />
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

      {/* Optional: subtle context line (premium, not gamified) */}
      <div className="text-xs text-ink-muted/60 dark:text-white/30">
        Modelling against your next milestone: <span className="text-ink dark:text-white font-semibold tabular-nums">
          {milestoneTarget ? `£${Math.round(milestoneTarget).toLocaleString()}` : '—'}
        </span>
      </div>

      {/* What-if accelerator */}
      <WhatIfCard
        goalTarget={milestoneTarget}
        accounts={accounts}
        onSimulationChange={setSimulation}
      />

      {/* Pro projection: dual line baseline vs simulated (locked preview if free) */}
      <ProProjectionCard
        accounts={accounts}
        goalTarget={retirementTarget}
        goalName={primaryGoal?.name || 'Retirement'}
        milestoneTarget={milestoneTarget}
        simulation={simulation}
      />

      {/* Insights list */}
      {visibleInsights.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-5xl mb-5 opacity-25">💡</div>
          <p className="text-ink-muted dark:text-white/40 mb-2">No insights yet</p>
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
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35">
                <Icon size={14} />
                {CATEGORY_LABELS[cat] || cat}
              </div>

              {items.map((ins, i) => (
                <Card
                  key={`${cat}-${i}`}
                  className={`p-6 border-l-4 ${TONE_STYLES[ins.tone] || TONE_STYLES.neutral}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-ink dark:text-white mb-1.5">
                        {ins.title}
                      </h3>
                      <p className="text-sm text-ink-muted dark:text-white/45 leading-relaxed">
                        {ins.body}
                      </p>
                    </div>

                    {ins.action === 'strategy' && (
                      <button
                        onClick={() => setPage('outlook')}
                        className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-dark transition-colors whitespace-nowrap mt-1"
                        type="button"
                      >
                        View in Outlook <ArrowRight size={13} />
                      </button>
                    )}

                    {ins.action === 'record' && (
                      <button
                        onClick={async () => {
                          try {
                            await api('/snapshots')
                            load()
                          } catch {
                            // ignore
                          }
                        }}
                        className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-dark transition-colors whitespace-nowrap mt-1"
                        type="button"
                      >
                        Record now <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )
        })
      )}

      {/* Subtle lock row */}
      {!isPro && lockedCount > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs text-ink-muted/60 dark:text-white/30">
            <Lock
              size={14}
              className="text-amber-600/90 dark:text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.25)]"
            />
            <span className="tabular-nums">
              Showing {visibleInsights.length} of {insights.length} insights
            </span>
            <span className="text-ink-muted/40 dark:text-white/20">· {lockedCount} locked for Pro</span>
          </div>

          <button
            onClick={() => setPage('upgrade')}
            className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:opacity-80 transition-opacity"
            type="button"
          >
            Upgrade
          </button>
        </div>
      )}
    </div>
  )
}