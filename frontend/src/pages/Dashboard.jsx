import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import ChangePill from '../components/ChangePill'
import EmptyState from '../components/EmptyState'
import { fmtCurrency, fmtDate, fmtPct, fmtDateShort } from '../utils'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Camera, TrendingUp, Clock, Target } from 'lucide-react'

const RANGES = ['7D', '1M', '3M', '1Y', 'ALL']

export default function Dashboard() {
  const { baseCurrency, setBaseCurrency, showToast, setPage } = useApp()
  const [data, setData] = useState(null)
  const [range, setRange] = useState('1M')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (r) => {
    try {
      const d = await api(`/dashboard?range=${encodeURIComponent(r || range)}`)
      setData(d)
      setBaseCurrency(d.base_currency || 'GBP')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [range, setBaseCurrency])

  useEffect(() => { load(range) }, [range])

  const createSnapshot = async () => {
    try {
      await api('/snapshots', { method: 'POST' })
      showToast('Net worth recorded!')
      load(range)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-[240px] rounded-3xl skeleton" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-[130px] rounded-2xl skeleton" />)}
        </div>
        <div className="h-[300px] rounded-2xl skeleton" />
      </div>
    )
  }

  if (!data) return null

  const series = (data.series || []).map(p => ({
    t: p.t,
    date: fmtDateShort(p.t),
    value: Number(p.v),
  }))

  const ccy = data.base_currency || 'GBP'
  const total = data.current_total || 0
  const goal = data.goal || 0
  const goalPct = goal > 0 ? Math.min(100, (total / goal) * 100) : 0
  const rangeChange = data.range_change || 0
  const rangeChangePct = data.range_change_pct || 0

  return (
    <div className="space-y-6">
      {/* ═══ Hero — Premium Wealth Overview ═══ */}
      <div className="hero-panel rounded-3xl p-7 sm:p-10">
        {/* Soft accent glow */}
        <div className="absolute top-[-80px] right-[-40px] w-[350px] h-[350px] bg-accent/[.06] dark:bg-accent/[.08] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="space-y-4">
            {/* Section label */}
            <div className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/70 dark:text-white/35">
              Your Wealth
            </div>

            {/* Primary net worth */}
            <div className="hero-number text-ink dark:text-white">
              {fmtCurrency(total, ccy)}
            </div>

            {/* Delta pill + range */}
            {data.total_snapshots > 0 && (
              <div className="flex items-center gap-3">
                <ChangePill
                  change={rangeChange}
                  changePct={rangeChangePct}
                  currency={ccy}
                  size="md"
                />
                <span className="text-xs text-ink-muted/50 dark:text-white/25">past {range}</span>
              </div>
            )}

            {/* Calm subline */}
            <p className="text-sm text-ink-muted/60 dark:text-white/30 max-w-xs leading-relaxed">
              Building long-term financial independence.
            </p>

            {/* Meta counts */}
            <div className="flex items-center gap-4 text-xs text-ink-muted/50 dark:text-white/25">
              <span>{data.accounts_count || 0} account{data.accounts_count !== 1 ? 's' : ''}</span>
              <span className="w-px h-3 bg-current opacity-30" />
              <span>{data.total_snapshots || 0} record{data.total_snapshots !== 1 ? 's' : ''}</span>
              {data.excluded_accounts > 0 && (
                <>
                  <span className="w-px h-3 bg-current opacity-30" />
                  <span className="text-amber-600/70 dark:text-amber-400/50">{data.excluded_accounts} excluded</span>
                </>
              )}
            </div>
          </div>

          {/* Goal (if set) */}
          {goal > 0 && (
            <div className="text-right sm:min-w-[140px]">
              <div className="text-xs font-semibold tracking-[.1em] uppercase text-ink-muted/50 dark:text-white/25 flex items-center gap-1.5 justify-end">
                <Target size={12} /> Goal
              </div>
              <div className="font-display text-2xl text-amber-600 dark:text-amber-400 mt-2 tabular-nums">
                {fmtCurrency(goal, ccy)}
              </div>
              <div className="text-xs text-ink-muted/50 dark:text-white/25 mt-1 tabular-nums">
                {goalPct >= 100 ? 'Reached!' : `${fmtCurrency(goal - total, ccy)} to go`}
              </div>
            </div>
          )}
        </div>

        {/* Goal progress bar */}
        {goal > 0 && (
          <div className="relative mt-8 pt-6 border-t border-black/[.05] dark:border-white/[.05]">
            <div className="h-2 bg-black/[.05] dark:bg-white/[.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-blue-400 rounded-full transition-all duration-700"
                style={{ width: `${goalPct.toFixed(1)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-ink-muted/40 dark:text-white/20 mt-2 tabular-nums">
              <span>{fmtCurrency(0, ccy)}</span>
              <span className="font-semibold text-ink-muted/60 dark:text-white/30">{goalPct.toFixed(0)}%</span>
              <span>{fmtCurrency(goal, ccy)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Quick Actions ═══ */}
      <div className="flex gap-3">
        <button
          onClick={createSnapshot}
          className="flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors active:scale-[.97] touch-press"
        >
          <Camera size={17} /> Record net worth
        </button>
        <button
          onClick={() => setPage('accounts')}
          className="flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors touch-press"
        >
          Add account
        </button>
      </div>

      {/* ═══ Stats Row ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/40 mb-3 flex items-center gap-2">
            <TrendingUp size={14} /> Change ({range})
          </div>
          {data.total_snapshots > 0 ? (
            <>
              <div className={`font-display text-2xl tracking-tight tabular-nums ${
                rangeChange >= 0 ? 'text-gain' : 'text-loss'
              }`}>
                {rangeChange >= 0 ? '+' : ''}{fmtCurrency(rangeChange, ccy)}
              </div>
              <div className="mt-3">
                <ChangePill change={rangeChange} changePct={rangeChangePct} currency={ccy} size="sm" showAmount={false} />
              </div>
            </>
          ) : (
            <div className="text-xl text-ink-muted dark:text-white/30">—</div>
          )}
        </Card>

        <Card className="p-6">
          <div className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/40 mb-3 flex items-center gap-2">
            <Clock size={14} /> Latest Record
          </div>
          <div className="font-display text-2xl text-ink dark:text-white tracking-tight tabular-nums">
            {data.latest_snapshot_total > 0 ? fmtCurrency(data.latest_snapshot_total, ccy) : '—'}
          </div>
          <div className="text-xs text-ink-muted/50 dark:text-white/25 mt-2">
            {series.length > 0 ? fmtDate(series[series.length - 1]?.t) : 'No records yet'}
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/40 mb-3 flex items-center gap-2">
            <Camera size={14} /> History
          </div>
          <div className="font-display text-2xl text-ink dark:text-white tracking-tight tabular-nums">
            {data.total_snapshots || 0}
          </div>
          <div className="text-xs text-ink-muted/50 dark:text-white/25 mt-2">data points</div>
        </Card>
      </div>

      {/* ═══ Chart ═══ */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-ink dark:text-white">Net worth over time</h3>
          <div className="flex bg-surface-2 dark:bg-white/5 rounded-full p-0.5 gap-0.5">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-xs font-semibold px-3.5 py-2 rounded-full transition-all min-w-[44px] ${
                  range === r
                    ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm'
                    : 'text-ink-muted dark:text-white/40 hover:text-ink dark:hover:text-white/70'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {series.length < 2 ? (
          <EmptyState
            icon="📈"
            title="Not enough data yet"
            subtitle="Record your net worth at least twice to see your trend"
            action={
              <button onClick={createSnapshot} className="text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors">
                Record net worth
              </button>
            }
          />
        ) : (
          <div className="h-[220px] sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b7cc4" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#3b7cc4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.04} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'currentColor', fillOpacity: 0.3 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'currentColor', fillOpacity: 0.3 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  tickFormatter={v => {
                    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
                    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
                    return v
                  }}
                />
                <Tooltip content={<ChartTooltip ccy={ccy} />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b7cc4"
                  strokeWidth={2.5}
                  fill="url(#areaFill)"
                  dot={false}
                  activeDot={{ r: 5, stroke: '#3b7cc4', strokeWidth: 2, fill: 'white' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  )
}

function ChartTooltip({ active, payload, ccy }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-ink dark:bg-surface-dark-3 text-white px-4 py-3 rounded-2xl shadow-lg text-sm border border-white/5">
      <div className="font-bold tabular-nums">{fmtCurrency(d.value, ccy)}</div>
      <div className="text-white/50 mt-0.5 text-xs">{fmtDate(d.t)}</div>
    </div>
  )
}
