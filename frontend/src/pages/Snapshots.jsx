import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiDelete } from "../api";
import { useApp } from '../App'
import Card from '../components/Card'
import ChangePill from '../components/ChangePill'
import EmptyState from '../components/EmptyState'
import { fmtCurrency, fmtDate } from '../utils'
import { Camera, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

export default function Snapshots() {
  const { showToast } = useApp()
  const [snaps, setSnaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    try { setSnaps(await apiGet('/snapshots')) } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    try { await apiPost('/snapshots'); showToast('Net worth recorded!'); load() } catch(e) { showToast(e.message,'error') }
  }

  const del = async (id) => {
    if (!confirm('Delete this record?')) return
    try { await apiDelete(`/snapshots/${id}`); showToast('Deleted'); load() } catch(e) { showToast(e.message,'error') }
  }

  const sorted = [...snaps].sort((a,b) => new Date(b.created_at)-new Date(a.created_at))

  if (loading) return <div className="space-y-5"><div className="h-12 w-48 rounded-lg skeleton"/>{[1,2,3].map(i=><div key={i} className="h-24 rounded-2xl skeleton"/>)}</div>

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">Net Worth History</h1>
          <p className="text-sm text-ink-muted dark:text-white/35 mt-1.5">Record your net worth to track progress over time.</p>
        </div>
        <button onClick={create} className="flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all active:scale-[.97] touch-press min-h-[44px]">
          <Camera size={17}/> Record
        </button>
      </div>

      {sorted.length===0 ? (
        <Card><EmptyState icon="📸" title="No history yet" subtitle="Record your net worth to start tracking it over time." action={<button onClick={create} className="text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors">Record net worth</button>}/></Card>
      ) : (
        <Card className="divide-y divide-black/[.04] dark:divide-white/[.04]">
          {sorted.map((snap, i) => {
            const prev = sorted[i+1]
            const delta = prev ? snap.total_base - prev.total_base : null
            const deltaPct = prev && prev.total_base !== 0 ? ((snap.total_base - prev.total_base) / Math.abs(prev.total_base)) * 100 : null
            const isExpanded = expanded === snap.id
            const breakdown = snap.breakdown || []

            return (
              <div key={snap.id} className="px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-display text-xl sm:text-2xl text-ink dark:text-white tracking-tight tabular-nums">
                        {fmtCurrency(snap.total_base, snap.base_currency)}
                      </div>
                      <div className="text-xs text-ink-muted dark:text-white/35 mt-1">
                        {fmtDate(snap.created_at)}
                        {snap.excluded_accounts > 0 && ` · ${snap.excluded_accounts} excluded`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {delta !== null ? (
                      <ChangePill change={delta} changePct={deltaPct||0} currency={snap.base_currency} size="sm" />
                    ) : (
                      <span className="text-xs text-ink-muted dark:text-white/25 font-medium">First</span>
                    )}
                    {breakdown.length > 0 && (
                      <button onClick={()=>setExpanded(isExpanded?null:snap.id)} className="p-2 rounded-xl hover:bg-surface-2 dark:hover:bg-white/5 text-ink-muted dark:text-white/35 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                        {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                    )}
                    <button onClick={()=>del(snap.id)} className="p-2 rounded-xl hover:bg-loss-light dark:hover:bg-loss/10 text-ink-muted/30 hover:text-loss transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                      <Trash2 size={15}/>
                    </button>
                  </div>
                </div>

                {isExpanded && breakdown.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-black/[.03] dark:border-white/[.03] space-y-2.5 animate-fade-in">
                    {breakdown.map(b => (
                      <div key={b.id} className="flex justify-between items-center text-sm">
                        <span className="text-ink-muted dark:text-white/45">{b.name} <span className="text-ink-muted/40 dark:text-white/20">({b.currency})</span></span>
                        <span className="text-ink dark:text-white font-medium tabular-nums">{fmtCurrency(b.value_base, snap.base_currency)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
