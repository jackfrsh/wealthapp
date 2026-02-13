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
      <div className="space-y-5">
        <div className="h-[200px] rounded-3xl skeleton" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-[120px] rounded-2xl skeleton" />)}
        </div>
        <div className="h-[280px] rounded-2xl skeleton" />
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
    <div className="space-y-5">
      {/* ═══ Hero — dominant net worth ═══ */}
      <div className="relative overflow-hidden rounded-3xl bg-ink dark:bg-surface-dark-3 p-7 sm:p-9">
        {/* Accent glow */}
        <div className="absolute top-[-60px] right-[-60px] w-[300px] h-[300px] bg-accent/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div>
            <div className="text-[11px] font-semibold tracking-[.12em] uppercase text-white/40 mb-2">
              Net Worth
            </div>
            <div className="font-display text-[44px] sm:text-[56px] leading-none text-white tracking-tight mb-3 tabular-nums">
              {fmtCurrency(total, ccy)}
            </div>

            {data.total_snapshots > 0 && (
              <div className="mb-3">
                <ChangePill
                  change={rangeChange}
                  changePct={rangeChangePct}
                  currency={ccy}
                  size="md"
                />
                <span className="text-xs text-white/30 ml-2">past {range}</span>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-white/35">
              <span>{data.accounts_count || 0} accounts</span>
              <span>{data.total_snapshots || 0} records</span>
              {data.excluded_accounts > 0 && (
                <span className="text-amber-400/60">{data.excluded_accounts} excluded (FX)</span>
              )}
            </div>
          </div>

          {/* Goal */}
          {goal > 0 && (
            <div className="text-right">
              <div className="text-[10px] font-semibold tracking-[.1em] uppercase text-white/30 flex items-center gap-1 justify-end">
                <Target size={11} /> Goal
              </div>
              <div className="font-display text-xl text-amber-400 mt-1 tabular-nums">
                {fmtCurrency(goal, ccy)}
              </div>
              <div className="text-xs text-white/30 mt-0.5 tabular-nums">
                {goalPct >= 100 ? '🎯 Reached!' : `${fmtCurrency(goal - total, ccy)} to go`}
              </div>
            </div>
          )}
        </div>

        {/* Goal progress */}
        {goal > 0 && (
          <div className="relative mt-6 pt-5 border-t border-white/[.06]">
            <div className="h-1.5 bg-white/[.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent to-blue-400 rounded-full transition-all duration-700"
                style={{ width: `${goalPct.toFixed(1)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/25 mt-1.5 tabular-nums">
              <span>{fmtCurrency(0, ccy)}</span>
              <span>{goalPct.toFixed(0)}%</span>
              <span>{fmtCurrency(goal, ccy)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Quick Actions ═══ */}
      <div className="flex gap-3">
        <button
          onClick={createSnapshot}
          className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-accent text-white hover:bg-accent-dark transition-colors active:scale-[.97]"
        >
          <Camera size={16} /> Record net worth
        </button>
        <button
          onClick={() => setPage('accounts')}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-xl border border-black/[.08] dark:border-white/[.08] text-ink dark:text-white hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
        >
          Add account
        </button>
      </div>

      {/* ═══ Stats Row ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="p-5">
          <div className="text-[10px] font-bold tracking-[.1em] uppercase text-ink-muted dark:text-white/40 mb-2.5 flex items-center gap-1.5">
            <TrendingUp size={12} /> Change ({range})
          </div>
          {data.total_snapshots > 0 ? (
            <>
              <div className={`font-display text-2xl tracking-tight tabular-nums ${
                rangeChange >= 0 ? 'text-gain' : 'text-loss'
              }`}>
                {rangeChange >= 0 ? '+' : ''}{fmtCurrency(rangeChange, ccy)}
              </div>
              <div className="mt-2">
                <ChangePill change={rangeChange} changePct={rangeChangePct} currency={ccy} size="sm" showAmount={false} />
              </div>
            </>
          ) : (
            <div className="text-lg text-ink-muted dark:text-white/30">—</div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-[10px] font-bold tracking-[.1em] uppercase text-ink-muted dark:text-white/40 mb-2.5 flex items-center gap-1.5">
            <Clock size={12} /> Latest Record
          </div>
          <div className="font-display text-2xl text-ink dark:text-white tracking-tight tabular-nums">
            {data.latest_snapshot_total > 0 ? fmtCurrency(data.latest_snapshot_total, ccy) : '—'}
          </div>
          <div className="text-[11px] text-ink-muted/60 dark:text-white/25 mt-2">
            {series.length > 0 ? fmtDate(series[series.length - 1]?.t) : 'No records yet'}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-[10px] font-bold tracking-[.1em] uppercase text-ink-muted dark:text-white/40 mb-2.5 flex items-center gap-1.5">
            <Camera size={12} /> History
          </div>
          <div className="font-display text-2xl text-ink dark:text-white tracking-tight tabular-nums">
            {data.total_snapshots || 0}
          </div>
          <div className="text-[11px] text-ink-muted/60 dark:text-white/25 mt-1">data points</div>
        </Card>
      </div>

      {/* ═══ Chart ═══ */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink dark:text-white">Net worth over time</h3>
          <div className="flex bg-surface-2 dark:bg-white/5 rounded-full p-0.5 gap-0.5">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all ${
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
              <button onClick={createSnapshot} className="text-xs font-semibold px-4 py-2 rounded-xl bg-accent text-white hover:bg-accent-dark transition-colors">
                Record net worth
              </button>
            }
          />
        ) : (
          <div className="h-[200px] sm:h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82c4" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#3b82c4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.04} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'currentColor', fillOpacity: 0.3 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'currentColor', fillOpacity: 0.3 }}
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
                  stroke="#3b82c4"
                  strokeWidth={2.5}
                  fill="url(#areaFill)"
                  dot={false}
                  activeDot={{ r: 5, stroke: '#3b82c4', strokeWidth: 2, fill: 'white' }}
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
    <div className="bg-ink dark:bg-surface-dark-3 text-white px-3.5 py-2.5 rounded-xl shadow-lg text-xs border border-white/5">
      <div className="font-bold text-sm tabular-nums">{fmtCurrency(d.value, ccy)}</div>
      <div className="text-white/50 mt-0.5">{fmtDate(d.t)}</div>
    </div>
  )
}
