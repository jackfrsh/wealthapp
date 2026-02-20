import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from "../api";
import { useApp } from '../App'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import { fmtCurrency, fmtDate } from '../utils'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { TrendingUp, Calendar } from 'lucide-react'

const HORIZONS = [5, 10, 15, 20, 25, 30, 40]

export default function Projections() {
  const { baseCurrency, showToast, setPage } = useApp()
  const [data, setData] = useState(null)
  const [years, setYears] = useState(25)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState([])

  const load = useCallback(async (y) => {
    try {
      const [proj, hist] = await Promise.all([
        apiGet(`/projection/networth?years=${y || years}`),
        apiGet('/history/networth?days=3650'),
      ])
      setData(proj)
      setHistory(hist.points || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [years])

  useEffect(() => { load(years) }, [years])

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-12 w-48 rounded-lg skeleton" />
        <div className="h-[320px] rounded-2xl skeleton" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[1,2,3,4].map(i=><div key={i} className="h-28 rounded-2xl skeleton" />)}</div>
      </div>
    )
  }

  if (!data || !data.points || data.points.length === 0) {
    return (
      <div className="space-y-7">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">Projections</h1>
          <p className="text-sm text-ink-muted dark:text-white/35 mt-1.5">See where your wealth is headed.</p>
        </div>
        <Card>
          <EmptyState
            icon="🔮"
            title="No accounts to project"
            subtitle="Add accounts with balances to see your projected growth."
            action={<button onClick={() => setPage('accounts')} className="text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors">Go to accounts</button>}
          />
        </Card>
      </div>
    )
  }

  const ccy = data.base_currency || baseCurrency
  const milestones = data.milestones || []
  const points = data.points || []

  // Build combined chart data: historical (actual) + projected
  const chartData = []

  // Add historical points
  for (const h of history) {
    chartData.push({
      date: h.date,
      label: new Date(h.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      actual: h.net_worth,
      projected: null,
    })
  }

  // Sample projected points (every 3 months to keep it readable)
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i % 3 === 0 || i === points.length - 1) {
      chartData.push({
        date: points[i].date,
        label: new Date(points[i].date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        actual: i === 0 ? points[i].projected_net_worth : null,
        projected: points[i].projected_net_worth,
      })
    }
  }

  // Current value for reference
  const currentValue = points[0]?.projected_net_worth || 0

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">Projections</h1>
          <p className="text-sm text-ink-muted dark:text-white/35 mt-1.5">
            Based on your accounts' contributions and expected returns.
          </p>
        </div>
        <div className="flex bg-surface-2 dark:bg-white/5 rounded-full p-0.5 gap-0.5 flex-wrap">
          {HORIZONS.map(h => (
            <button
              key={h}
              onClick={() => setYears(h)}
              className={`text-xs font-semibold px-3.5 py-2 rounded-full transition-all min-w-[44px] min-h-[36px] ${
                years === h
                  ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm'
                  : 'text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white/60'
              }`}
            >
              {h}Y
            </button>
          ))}
        </div>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {milestones.slice(0, 4).map(m => (
            <Card key={m.year} className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={13} className="text-ink-muted dark:text-white/35" />
                <span className="text-xs font-semibold tracking-[.08em] uppercase text-ink-muted dark:text-white/35">
                  In {m.year} year{m.year !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="font-display text-xl text-ink dark:text-white tracking-tight tabular-nums">
                {fmtCurrency(m.projected_net_worth, ccy)}
              </div>
              <div className="text-xs text-ink-muted/40 dark:text-white/20 mt-1.5">
                {fmtDate(m.date)}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Chart */}
      <Card className="p-6 sm:p-8">
        <div className="flex items-center gap-4 mb-5">
          <h3 className="text-sm font-semibold text-ink dark:text-white">Actual vs Projected</h3>
          <div className="flex items-center gap-4 text-xs text-ink-muted dark:text-white/35">
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-accent rounded-full inline-block" /> Actual</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-accent/40 rounded-full inline-block border border-dashed border-accent" /> Projected</span>
          </div>
        </div>

        <div className="h-[260px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b7cc4" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#3b7cc4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.04} />
              <XAxis dataKey="label" tick={{fontSize:11, fill:'currentColor', fillOpacity:0.3}} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{fontSize:11, fill:'currentColor', fillOpacity:0.3}} axisLine={false} tickLine={false} width={65} tickFormatter={v => {
                if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`
                if (v >= 1e3) return `${(v/1e3).toFixed(0)}K`
                return v
              }} />
              <Tooltip
                content={<WealthTooltip currency={baseCurrency} />}
                cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
              />
              <Area type="monotone" dataKey="actual" stroke="#3b7cc4" strokeWidth={2.5} fill="url(#projFill)" dot={false} connectNulls={false} />
              <Area type="monotone" dataKey="projected" stroke="#3b7cc4" strokeWidth={2} strokeDasharray="6 4" fill="url(#projFill)" dot={false} connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* All milestones table */}
      {milestones.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[.04] dark:border-white/[.04]">
            <h3 className="text-sm font-semibold text-ink dark:text-white flex items-center gap-2">
              <TrendingUp size={15} /> Milestone Summary
            </h3>
          </div>
          <div className="divide-y divide-black/[.03] dark:divide-white/[.03]">
            {milestones.map(m => {
              const growth = currentValue > 0 ? ((m.projected_net_worth - currentValue) / currentValue * 100) : 0
              return (
                <div key={m.year} className="flex items-center justify-between px-6 py-4">
                  <div className="text-sm text-ink dark:text-white">
                    <span className="font-semibold">{m.year}</span> year{m.year !== 1 ? 's' : ''}
                    <span className="text-ink-muted dark:text-white/35 ml-2 text-xs">{fmtDate(m.date)}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg text-ink dark:text-white tabular-nums">{fmtCurrency(m.projected_net_worth, ccy)}</div>
                    <div className={`text-xs font-semibold ${growth >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {growth >= 0 ? '+' : ''}{growth.toFixed(0)}% from today
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {data.excluded_accounts > 0 && (
        <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-5 py-3 rounded-2xl">
          {data.excluded_accounts} account(s) excluded due to missing FX rates.
        </div>
      )}
    </div>
  )
}

function ProjTooltip({ active, payload, ccy }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-ink dark:bg-surface-dark-3 text-white px-4 py-3 rounded-2xl shadow-lg text-sm border border-white/5">
      {d.actual != null && <div className="font-bold tabular-nums">{fmtCurrency(d.actual, ccy)} <span className="font-normal text-white/50">actual</span></div>}
      {d.projected != null && <div className="font-bold tabular-nums">{fmtCurrency(d.projected, ccy)} <span className="font-normal text-white/50">projected</span></div>}
      <div className="text-white/40 mt-0.5 text-xs">{d.date}</div>
    </div>
  )
}
