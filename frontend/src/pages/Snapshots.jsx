import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
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
    try { setSnaps(await api('/snapshots')) } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    try { await api('/snapshots',{method:'POST'}); showToast('Snapshot created!'); load() } catch(e) { showToast(e.message,'error') }
  }

  const del = async (id) => {
    if (!confirm('Delete this snapshot?')) return
    try { await api(`/snapshots/${id}`,{method:'DELETE'}); showToast('Deleted'); load() } catch(e) { showToast(e.message,'error') }
  }

  // Sort newest first
  const sorted = [...snaps].sort((a,b) => new Date(b.created_at)-new Date(a.created_at))

  if (loading) return <div className="space-y-4"><div className="h-10 w-48 rounded-lg skeleton"/>{[1,2,3].map(i=><div key={i} className="h-20 rounded-2xl skeleton"/>)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">Snapshots</h1>
          <p className="text-sm text-ink-muted dark:text-white/40 mt-1">Point-in-time net worth history.</p>
        </div>
        <button onClick={create} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-ink dark:bg-white text-white dark:text-ink hover:opacity-90 transition-all active:scale-[.97]">
          <Camera size={16}/> New snapshot
        </button>
      </div>

      {sorted.length===0 ? (
        <Card><EmptyState icon="📸" title="No snapshots yet" subtitle="Create one to start tracking your net worth over time." action={<button onClick={create} className="text-xs font-semibold px-4 py-2 rounded-xl bg-accent text-white">+ Create snapshot</button>}/></Card>
      ) : (
        <Card className="divide-y divide-black/[.04] dark:divide-white/[.04]">
          {sorted.map((snap, i) => {
            const prev = sorted[i+1]
            const delta = prev ? snap.total_base - prev.total_base : null
            const deltaPct = prev && prev.total_base !== 0 ? ((snap.total_base - prev.total_base) / Math.abs(prev.total_base)) * 100 : null
            const isExpanded = expanded === snap.id
            const breakdown = snap.breakdown || []

            return (
              <div key={snap.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-display text-xl text-ink dark:text-white tracking-tight">
                        {fmtCurrency(snap.total_base, snap.base_currency)}
                      </div>
                      <div className="text-[11px] text-ink-muted dark:text-white/40 mt-0.5">
                        {fmtDate(snap.created_at)}
                        {snap.excluded_accounts > 0 && ` · ${snap.excluded_accounts} excluded`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {delta !== null ? (
                      <ChangePill change={delta} changePct={deltaPct||0} currency={snap.base_currency} size="sm" />
                    ) : (
                      <span className="text-[11px] text-ink-muted dark:text-white/30 font-medium">First</span>
                    )}
                    {breakdown.length > 0 && (
                      <button onClick={()=>setExpanded(isExpanded?null:snap.id)} className="p-1 rounded-lg hover:bg-surface-2 dark:hover:bg-white/5 text-ink-muted dark:text-white/40 transition-colors">
                        {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                      </button>
                    )}
                    <button onClick={()=>del(snap.id)} className="p-1 rounded-lg hover:bg-danger-light dark:hover:bg-danger/10 text-ink-muted/40 hover:text-danger transition-colors">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>

                {/* Breakdown */}
                {isExpanded && breakdown.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-black/[.03] dark:border-white/[.03] space-y-1.5 animate-fade-in">
                    {breakdown.map(b => (
                      <div key={b.id} className="flex justify-between items-center text-xs">
                        <span className="text-ink-muted dark:text-white/50">{b.name} <span className="text-ink-muted/40 dark:text-white/20">({b.currency})</span></span>
                        <span className="text-ink dark:text-white font-medium">{fmtCurrency(b.value_base, snap.base_currency)}</span>
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
