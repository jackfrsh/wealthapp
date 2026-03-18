import React from 'react'
import Card from '../Card'
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
  return (
    <Card className={`${planTheme.sectionCard} overflow-hidden`}>
      <button
        onClick={() => setProjOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-5 sm:px-6 py-5 ${planTheme.title} hover:bg-surface-2/50 dark:hover:bg-white/[.02] transition-colors`}
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
        <div className={`border-t ${planTheme.divider} animate-fade-in`}>
          <div className="px-5 sm:px-6 pt-5 pb-3 flex items-center justify-between gap-4 flex-wrap">
            <p className={planTheme.body}>
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
            <div className="px-5 sm:px-6 pb-7">
              <div className={`h-[260px] skeleton ${planTheme.innerPanel} ${planTheme.mobileChartBleed}`} />
            </div>
          ) : !projData || !projData.points?.length ? (
            <div className="px-5 sm:px-6 pb-7 text-center py-10">
              <p className="text-sm text-ink-muted dark:text-white/35">
                Add accounts with balances to see projections.
              </p>
            </div>
          ) : (
            <div className="px-5 sm:px-6 pb-7 space-y-5">
              {filteredMilestones.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {filteredMilestones.map((m) => (
                    <div
                      key={m.year}
                      className={`${planTheme.innerPanelCompact} ${planTheme.mobileInnerBleed}`}
                    >
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

              <div className={`${planTheme.innerPanel} ${planTheme.mobileChartBleed}`}>
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
                <div
                  className={`flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-amber-50 dark:bg-amber-500/[.06] border border-amber-500/15 ${planTheme.mobileInnerBleed}`}
                >
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
            </div>
          )}
        </div>
      )}
    </Card>
  )
}