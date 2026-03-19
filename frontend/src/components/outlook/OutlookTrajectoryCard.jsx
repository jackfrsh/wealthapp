import React from 'react'
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
import WealthTooltip from '../charts/WealthTooltip'
import {
  xAxisProps,
  yAxisProps,
  gridProps,
  tooltipProps,
  compactTickFormatter,
  chartMargin,
  ACCENT_STROKE,
  activeDotStyle,
} from '../charts/chartTheme'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { fmtCurrency } from '../../utils'
import { planTheme } from './planTheme'
import PlanSectionFrame from './PlanSectionFrame'

const innerPanel =
  planTheme.innerPanel ||
  'rounded-2xl border border-black/[.05] dark:border-white/[.06] bg-black/[.02] dark:bg-white/[.04] p-4 sm:p-5'

const innerPanelCompact =
  planTheme.innerPanelCompact ||
  'rounded-2xl border border-black/[.05] dark:border-white/[.06] bg-black/[.02] dark:bg-white/[.04] p-4'

export default function OutlookTrajectoryCard({
  trajOpen,
  setTrajOpen,
  chartData,
  derived,
  ccy,
  lbl,
  inp,
  localContrib,
  setLocalContrib,
  localReturn,
  setLocalReturn,
  dirty,
  setDirty,
  loading,
  applyAssumptions,
  bestScenario,
  compareLoading,
}) {
  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h3 className={planTheme.title}>Plan Trajectory</h3>
        <div className={`mt-1 ${planTheme.body}`}>Projected net worth over time</div>

        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-muted dark:text-white/35">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-accent rounded-full inline-block" /> Current plan
          </span>

          {!compareLoading && bestScenario && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-emerald-500 rounded-full inline-block" /> Best scenario
            </span>
          )}

          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-ink-muted/30 dark:bg-white/20 rounded-full inline-block" /> Required
          </span>

          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 border-2 border-amber-500 rounded-full inline-block" /> Target
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setTrajOpen((v) => !v)}
        className={planTheme.buttonSecondary}
      >
        {trajOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {trajOpen ? 'Hide' : 'Show'}
      </button>
    </div>
  )

  return (
    <PlanSectionFrame header={header}>
      {!trajOpen ? null : (
        <div className="space-y-5">
          {!compareLoading && bestScenario && (
            <div className={innerPanelCompact}>
              <div className={`${planTheme.eyebrowAccent} flex items-center gap-2`}>
                <Sparkles size={12} />
                Comparing against
              </div>
              <div className="mt-1 text-sm text-ink dark:text-white">{bestScenario.name}</div>
            </div>
          )}

          {chartData.length > 1 ? (
            <div className={innerPanel}>
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

                    {!compareLoading && bestScenario && (
                      <Area
                        type="monotone"
                        dataKey="compareProjected"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="8 5"
                        strokeOpacity={0.95}
                        fill="none"
                        dot={false}
                        connectNulls
                      />
                    )}

                    <Area
                      type="monotone"
                      dataKey="projected"
                      stroke={ACCENT_STROKE}
                      strokeWidth={2.4}
                      fill="url(#trajFill)"
                      dot={false}
                      activeDot={activeDotStyle}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-ink-muted dark:text-white/30 text-sm">
              Add accounts to see your trajectory
            </div>
          )}

          <div className={innerPanel}>
            <div className={planTheme.eyebrow}>Assumptions</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
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

                <div className="flex gap-2 mt-3 flex-wrap">
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
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition ${
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
                    className={`${planTheme.buttonPrimary} min-h-[44px] w-full sm:w-auto`}
                    disabled={loading}
                  >
                    {loading ? 'Updating…' : 'Update projection'}
                  </button>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-ink-muted/50 dark:text-white/25 leading-relaxed">
              Assumes {fmtCurrency(Number(localContrib || 0), ccy)}/month at {Number(localReturn || 0)}% annual growth.
              Returns are compounded monthly.
            </p>
          </div>
        </div>
      )}
    </PlanSectionFrame>
  )
}