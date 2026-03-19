import React from 'react'
import UpgradeButton from '../UpgradeButton'
import { fmtCurrency } from '../../utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import WealthTooltip from '../charts/WealthTooltip'
import {
  xAxisProps,
  yAxisProps,
  gridProps,
  tooltipProps,
  chartMargin,
  ACCENT_STROKE,
  activeDotStyle,
} from '../charts/chartTheme'
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Calendar,
  Crown,
  Lock,
} from 'lucide-react'
import { planTheme } from './planTheme'
import PlanSectionFrame from './PlanSectionFrame'

const innerPanel =
  planTheme.innerPanel ||
  'rounded-2xl border border-black/[.05] dark:border-white/[.06] bg-black/[.02] dark:bg-white/[.04] p-4 sm:p-5'

const innerPanelCompact =
  planTheme.innerPanelCompact ||
  'rounded-2xl border border-black/[.05] dark:border-white/[.06] bg-black/[.02] dark:bg-white/[.04] p-4'

export default function AccountProjectionsCard({
  projOpen,
  setProjOpen,
  settingsReady,
  isPro,
  HORIZONS,
  effectiveProjYears,
  setProjYears,
  goUpgrade,
  projLoading,
  projData,
  filteredMilestones,
  deflate,
  ccy,
  projChartData,
}) {
  const badge =
    settingsReady && !isPro ? (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
        <Crown size={10} /> Pro
      </span>
    ) : null

  const actions = (
    <button
      type="button"
      onClick={() => setProjOpen((v) => !v)}
      className={planTheme.buttonSecondary}
    >
      {projOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      {projOpen ? 'Hide' : 'Show'}
    </button>
  )

  return (
    <PlanSectionFrame
      icon={TrendingUp}
      title="Account Projections"
      subtitle="Based on your accounts’ contributions and expected returns."
      badge={badge}
      actions={actions}
    >
      {!projOpen ? null : (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className={planTheme.body}>Choose a projection horizon.</div>

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
                  onClick={() => goUpgrade('projection_horizon_locked')}
                  className="text-xs font-semibold px-3.5 py-2 rounded-full text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 transition-all flex items-center gap-1"
                  type="button"
                >
                  <Lock size={11} /> More
                </button>
              )}
            </div>
          </div>

          {projLoading ? (
            <div className={`${innerPanel} h-[260px] skeleton`} />
          ) : !projData || !projData.points?.length ? (
            <div className="text-center py-10">
              <p className="text-sm text-ink-muted dark:text-white/35">
                Add accounts with balances to see projections.
              </p>
            </div>
          ) : (
            <>
              {filteredMilestones.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {filteredMilestones.map((m) => (
                    <div key={m.year} className={innerPanelCompact}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Calendar size={11} className="text-ink-muted/70 dark:text-white/30" />
                        <span className={planTheme.statLabel}>In {m.year}y</span>
                      </div>

                      <div className="font-display text-xl sm:text-2xl text-ink dark:text-white tracking-tight tabular-nums leading-tight">
                        {fmtCurrency(deflate(m.projected_net_worth, m.year), ccy)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={innerPanel}>
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
                          new Date(d).toLocaleDateString('en-GB', {
                            month: 'short',
                            year: '2-digit',
                          })
                        }
                      />

                      <YAxis {...yAxisProps} tickFormatter={(v) => Math.round(v / 1000) + 'k'} />

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
              </div>

              {settingsReady && !isPro && filteredMilestones.length > 0 && (
                <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-amber-50 dark:bg-amber-500/[.06] border border-amber-500/15">
                  <div>
                    <div className="text-sm font-semibold text-ink dark:text-white">
                      See the full picture
                    </div>
                    <div className="text-xs text-ink-muted dark:text-white/35 mt-0.5">
                      Unlock 5–40 year projections, milestones and strategic tools.
                    </div>
                  </div>
                  <UpgradeButton onClick={() => goUpgrade('projection_footer_cta')} size="sm">
                    Upgrade
                  </UpgradeButton>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </PlanSectionFrame>
  )
}