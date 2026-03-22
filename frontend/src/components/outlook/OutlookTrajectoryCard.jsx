// frontend/src/components/outlook/OutlookTrajectoryCard.jsx
// Batch 4 recomposition: added `embedded` prop.
// When embedded=true, the component renders without its outer dark container —
// the parent (Outlook.jsx stage) provides the container context.
// When embedded=false (default), backward-compatible dark container is preserved.
//
// All chart logic, props, and calculations: unchanged.

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

const muted = { color: 'rgba(255,255,255,0.28)' }
const subdued = { color: 'rgba(255,255,255,0.38)' }

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
  // New: when true, skip outer dark container (parent owns it)
  embedded = false,
}) {
  const inner = (
    <>
      {/* ── Section header ── */}
      <div
        className="flex items-start justify-between gap-4"
        style={embedded
          ? { padding: '0 2rem 0 2rem' }
          : { padding: '2rem 2rem 1.5rem 2rem' }}
      >
        <div className="min-w-0">
          <div
            className="text-[10px] font-semibold tracking-[.16em] uppercase mb-2"
            style={muted}
          >
            Trajectory
          </div>

          <h3 className="serif-heading text-[20px] sm:text-[24px] text-white">
            The path ahead
          </h3>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px]" style={muted}>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-[2px] rounded-full inline-block bg-accent" />
              Current plan
            </span>

            {!compareLoading && bestScenario && (
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-[2px] rounded-full inline-block bg-emerald-500" />
                Best scenario
              </span>
            )}

            <span className="flex items-center gap-1.5">
              <span className="w-4 h-[2px] rounded-full inline-block" style={{ background: 'rgba(255,255,255,0.18)' }} />
              Required
            </span>

            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 border-2 border-amber-500 rounded-full inline-block" />
              Target
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTrajOpen((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.45)' }}
        >
          {trajOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {trajOpen ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* ── Chart + assumptions ── */}
      {trajOpen && (
        <div>
          {/* Best scenario context */}
          {!compareLoading && bestScenario && (
            <div className="mx-8 mt-4">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.50)' }}
              >
                <Sparkles size={10} style={{ color: 'rgba(255,255,255,0.35)' }} />
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>vs</span>
                {bestScenario.name}
              </div>
            </div>
          )}

          {/* Chart — tall, full bleed within the stage */}
          {chartData.length > 1 ? (
            <div className="mt-5 px-4 sm:px-6">
              <div className="h-[360px] sm:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={chartMargin}>
                    <defs>
                      <linearGradient id="trajFillEmbedded" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT_STROKE} stopOpacity={0.20} />
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
                      stroke="#C89B3C"
                      strokeDasharray="4 6"
                      strokeOpacity={0.45}
                    />

<Area
  type="monotone"
  dataKey="required"
  name="Required pace"
  stroke="currentColor"
  strokeWidth={1.5}
  strokeOpacity={0.14}
  strokeDasharray="6 4"
  fill="none"
  dot={false}
  connectNulls
/>

{!compareLoading && bestScenario && (
  <Area
    type="monotone"
    dataKey="compareProjected"
    name="Best scenario"
    stroke="#2FA676"
    strokeWidth={2}
    strokeDasharray="8 5"
    strokeOpacity={0.85}
    fill="none"
    dot={false}
    connectNulls
  />
)}

<Area
  type="monotone"
  dataKey="projected"
  name="Current plan"
  stroke={ACCENT_STROKE}
  strokeWidth={2.5}
  fill="url(#trajFillEmbedded)"
  dot={false}
  activeDot={activeDotStyle}
/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div
              className="mx-8 mt-5 h-[200px] flex items-center justify-center text-sm rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.28)' }}
            >
              Add accounts to see your trajectory
            </div>
          )}

          {/* ── Assumptions workbench — inline, no inner card ── */}
          <div className="mt-6 px-8 sm:px-10 pb-8">
            <div
              className="pt-6"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div
                className="text-[10px] font-semibold tracking-[.16em] uppercase mb-5"
                style={muted}
              >
                Assumptions
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs font-semibold mb-2"
                    style={{ color: 'rgba(255,255,255,0.42)' }}
                  >
                    Monthly contribution ({ccy})
                  </label>
                  <input
                    value={localContrib}
                    onChange={(e) => {
                      setLocalContrib(e.target.value)
                      setDirty(true)
                    }}
                    className="w-full px-4 py-3 rounded-2xl text-base focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.11)',
                      color: 'white',
                    }}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold mb-2"
                    style={{ color: 'rgba(255,255,255,0.42)' }}
                  >
                    Expected annual return (%)
                  </label>
                  <input
                    value={localReturn}
                    onChange={(e) => {
                      setLocalReturn(e.target.value)
                      setDirty(true)
                    }}
                    className="w-full px-4 py-3 rounded-2xl text-base focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.11)',
                      color: 'white',
                    }}
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
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                        style={
                          Number(localReturn) === s.value
                            ? { background: 'rgba(120,169,230,0.30)', border: '1px solid rgba(120,169,230,0.40)', color: 'rgba(243,245,247,0.92)' }
                            : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.38)' }
                        }
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
                      className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-2xl text-sm font-semibold transition-opacity"
                      style={{
                        background: 'var(--gold)',
                        color: '#0A0F1A',
                        opacity: loading ? 0.6 : 1,
                      }}
                      disabled={loading}
                    >
                      {loading ? 'Updating…' : 'Update projection'}
                    </button>
                  </div>
                )}
              </div>

              <p
                className="mt-4 text-xs leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.22)' }}
              >
                Assumes {fmtCurrency(Number(localContrib || 0), ccy)}/month at {Number(localReturn || 0)}% annual growth.
                Returns are compounded monthly.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // When embedded, the parent provides the stage container — return inner content only
  if (embedded) return inner

  // Backward-compatible standalone mode
  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl"
      style={{
        border: '1px solid rgba(255,255,255,0.07)',
        background: 'linear-gradient(160deg, #1E2535 0%, #141A26 100%)',
        boxShadow: '0 4px 40px rgba(0,0,0,0.38), 0 1px 4px rgba(0,0,0,0.24)',
      }}
    >
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-14 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.045) 0%, transparent 65%)' }}
      />
      {inner}
    </div>
  )
}