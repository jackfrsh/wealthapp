import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { fmtCurrency, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS, CURRENCIES } from '../utils'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const TYPES = ['bank','isa','sipp','crypto','investment','property','mortgage','loan','other']
const emptyForm = { name:'', type:'bank', currency:'GBP', balance:'', include_in_net_worth:true, notes:'', monthly_contribution:'', annual_interest_rate_percent:'' }

export default function Accounts() {
  const { baseCurrency, showToast } = useApp()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({...emptyForm})

  const load = useCallback(async () => {
    try { setAccounts(await api('/accounts')) } catch(e) { console.error(e) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditing(null); setForm({...emptyForm, currency: baseCurrency}); setModal(true) }
  const openEdit = (a) => {
    setEditing(a.id)
    setForm({ name:a.name, type:a.type, currency:a.currency, balance:String(a.balance), include_in_net_worth:a.include_in_net_worth, notes:a.notes||'', monthly_contribution:String(a.monthly_contribution||''), annual_interest_rate_percent:String(a.annual_interest_rate_percent||'') })
    setModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) { showToast('Name is required','error'); return }
    const body = { name:form.name.trim(), type:form.type, currency:form.currency, balance:Number(String(form.balance||'0').replace(/,/g,'')), include_in_net_worth:form.include_in_net_worth, notes:form.notes||null, monthly_contribution:Number(String(form.monthly_contribution||'0').replace(/,/g,'')), annual_interest_rate_percent:Number(String(form.annual_interest_rate_percent||'0').replace(/,/g,'')) }
    try {
      if (editing) { await api(`/accounts/${editing}`,{method:'PATCH',body}); showToast('Account updated') }
      else { await api('/accounts',{method:'POST',body}); showToast('Account added') }
      setModal(false); load()
    } catch(e) { showToast(e.message,'error') }
  }

  const del = async (a) => {
    if (!confirm(`Delete "${a.name}"?`)) return
    try { await api(`/accounts/${a.id}`,{method:'DELETE'}); showToast('Deleted'); load() } catch(e) { showToast(e.message,'error') }
  }

  const inp = "w-full px-3.5 py-2.5 rounded-xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-sm text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
  const lbl = "block text-xs font-semibold text-ink-3 dark:text-white/60 mb-1.5"

  if (loading) return <div className="space-y-4"><div className="h-10 w-48 rounded-lg skeleton"/><div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">{[1,2,3,4].map(i=><div key={i} className="h-[160px] rounded-2xl skeleton"/>)}</div></div>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">Accounts</h1>
          <p className="text-sm text-ink-muted dark:text-white/40 mt-1">Manage your financial accounts.</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-ink dark:bg-white text-white dark:text-ink hover:opacity-90 transition-all active:scale-[.97]">
          <Plus size={16}/> Add
        </button>
      </div>

      {accounts.length===0 ? (
        <Card><EmptyState icon="🏦" title="No accounts yet" subtitle="Add your first financial account." action={<button onClick={openAdd} className="text-xs font-semibold px-4 py-2 rounded-xl bg-accent text-white">+ Add account</button>}/></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {accounts.map(a=>(
            <Card key={a.id} hover className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{ACCOUNT_TYPE_ICONS[a.type]||'📦'}</span>
                  <div>
                    <div className="font-semibold text-sm text-ink dark:text-white">{a.name}</div>
                    <div className="text-[11px] text-ink-muted dark:text-white/40">{a.currency}</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold tracking-[.06em] uppercase px-2 py-0.5 rounded-full bg-surface-2 dark:bg-white/5 text-ink-muted dark:text-white/40">{ACCOUNT_TYPE_LABELS[a.type]||a.type}</span>
              </div>
              <div className="font-display text-2xl text-ink dark:text-white tracking-tight mb-1">{fmtCurrency(a.balance, a.currency)}</div>
              {!a.include_in_net_worth && <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mb-2">Excluded from net worth</div>}
              {(a.monthly_contribution>0||a.annual_interest_rate_percent>0) && (
                <div className="text-[11px] text-ink-muted/60 dark:text-white/30 mb-2">
                  {a.monthly_contribution>0&&`${fmtCurrency(a.monthly_contribution,a.currency)}/mo`}
                  {a.monthly_contribution>0&&a.annual_interest_rate_percent>0&&' · '}
                  {a.annual_interest_rate_percent>0&&`${a.annual_interest_rate_percent}% p.a.`}
                </div>
              )}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-black/[.04] dark:border-white/[.04]">
                <button onClick={()=>openEdit(a)} className="flex items-center gap-1 text-xs font-medium text-ink-muted dark:text-white/40 hover:text-ink dark:hover:text-white px-2 py-1.5 rounded-lg hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"><Pencil size={12}/> Edit</button>
                <button onClick={()=>del(a)} className="flex items-center gap-1 text-xs font-medium text-danger/60 hover:text-danger px-2 py-1.5 rounded-lg hover:bg-danger-light dark:hover:bg-danger/10 transition-colors"><Trash2 size={12}/> Delete</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={editing?'Edit account':'Add account'}>
        <div className="space-y-4">
          <div><label className={lbl}>Account name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className={inp} placeholder="ISA, Savings..."/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Type</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} className={inp}>{TYPES.map(t=><option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}</select></div>
            <div><label className={lbl}>Currency</label><select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} className={inp}>{CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div><label className={lbl}>Balance</label><input value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))} className={inp} placeholder="25000" inputMode="decimal"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Monthly contribution</label><input value={form.monthly_contribution} onChange={e=>setForm(f=>({...f,monthly_contribution:e.target.value}))} className={inp} placeholder="500" inputMode="decimal"/><div className="text-[10px] text-ink-muted dark:text-white/30 mt-1">For projections</div></div>
            <div><label className={lbl}>Annual return %</label><input value={form.annual_interest_rate_percent} onChange={e=>setForm(f=>({...f,annual_interest_rate_percent:e.target.value}))} className={inp} placeholder="7" inputMode="decimal"/><div className="text-[10px] text-ink-muted dark:text-white/30 mt-1">Expected yearly return</div></div>
          </div>
          <div className="flex items-center gap-2.5">
            <input type="checkbox" checked={form.include_in_net_worth} onChange={e=>setForm(f=>({...f,include_in_net_worth:e.target.checked}))} className="w-4 h-4 accent-accent rounded"/>
            <label className="text-sm text-ink-3 dark:text-white/60 cursor-pointer">Include in net worth</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-ink dark:bg-white text-white dark:text-ink font-semibold text-sm hover:opacity-90 transition-all">{editing?'Save changes':'Add account'}</button>
            <button onClick={()=>setModal(false)} className="px-4 py-2.5 rounded-xl border border-black/[.08] dark:border-white/[.08] text-sm font-medium text-ink-muted dark:text-white/40 hover:bg-surface-2 dark:hover:bg-white/5 transition-colors">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
