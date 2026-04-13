// frontend/src/pages/Accounts.jsx
// Batch 10: Premium wealth ledger — richer rows, grouped sections, dark header.
//
// Architecture:
//   Scene 1 — Header (full-bleed dark): net position + 5-stat grid
//   Scene 2 — Ledger: semantic groups (Cash, Investments, Pensions, Property, Liabilities)
//              4-zone rows: identity | monthly | rate | balance
//   Scene 3 — Composition: flat horizontal strip
//   Scene 4 — Snapshots: minimal, collapsed by default
//
// Unchanged: all CRUD, snapshot, free-tier, modal, API, state logic.

import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { api, invalidatePath } from '../api'
import { useApp } from '../App'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import ChangePill from '../components/ChangePill'
import { track } from '../track'
import { fmtCurrency, fmtCurrencyCompact, fmtDate, ACCOUNT_TYPE_LABELS, CURRENCIES, getSnapshotFreshnessState } from '../utils'
import { Plus, Camera, ChevronDown, ChevronRight, Clock, Crown, Pencil, Trash2, MoreHorizontal, Landmark } from 'lucide-react'

/* ── Wealth group taxonomy ────────────────────────── */

const WEALTH_GROUPS = [
  { key: 'cash',        label: 'Cash & Liquid',          types: ['bank'],                       isLiability: false },
  { key: 'investments', label: 'Investments & Wrappers', types: ['isa', 'investment', 'crypto'], isLiability: false },
  { key: 'pensions',    label: 'Pensions',               types: ['sipp'],                        isLiability: false },
  { key: 'property',    label: 'Property',               types: ['property'],                    isLiability: false },
  { key: 'other',       label: 'Other Assets',           types: ['other'],                       isLiability: false },
  { key: 'liabilities', label: 'Liabilities',            types: ['mortgage', 'loan'],            isLiability: true  },
]

const TYPE_ACCENT = {
  bank: '#78A9E6', isa: '#2FA676', investment: '#2FA676', crypto: '#C89B3C',
  sipp: '#7C3AED', property: '#B46438', mortgage: '#C05A46', loan: '#C05A46', other: '#6B7280',
}

const RATE_LABEL    = { bank: 'Rate', isa: 'Yield', investment: 'Yield', crypto: 'Yield', sipp: 'Growth', property: 'Yield', mortgage: 'APR', loan: 'APR', other: 'Rate' }
const MONTHLY_LABEL = { mortgage: 'Payment', loan: 'Payment' }

const TYPES = ['bank', 'isa', 'sipp', 'crypto', 'investment', 'property', 'mortgage', 'loan', 'other']
const LIABILITY_TYPES = new Set(['mortgage', 'loan'])

const emptyForm = { name: '', type: 'bank', currency: 'GBP', balance: '', include_in_net_worth: true, notes: '', monthly_contribution: '', annual_interest_rate_percent: '' }

/* ── Helpers ─────────────────────────────────────── */

function accountNamePlaceholder(type) {
  return { bank:'e.g. Barclays Current Account', isa:'e.g. Vanguard Stocks & Shares ISA', sipp:'e.g. Pension / SIPP', investment:'e.g. Trading 212 Portfolio', crypto:'e.g. Coinbase', property:'e.g. Home (estimated value)', mortgage:'e.g. Mortgage balance', loan:'e.g. Car loan' }[type] || 'e.g. Account name'
}
function toNumber(input, fallback = 0) { const s=String(input??'').trim(); if(!s)return fallback; const n=Number(s.replace(/,/g,'')); return Number.isFinite(n)?n:fallback }
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function snapBaseTotal(s){if(!s)return null;const n=Number(s.total_base);return Number.isFinite(n)?n:null}
function asArray(v){return Array.isArray(v)?v:[]}


/* ── LedgerEntryRow ──────────────────────────────── */

const ACCOUNT_STALE_DAYS = 60
const ACCOUNT_AGING_DAYS = 30

function accountStaleness(updatedAt) {
  if (!updatedAt) return null
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
  if (days >= ACCOUNT_STALE_DAYS) return { state: 'stale', days }
  if (days >= ACCOUNT_AGING_DAYS) return { state: 'aging', days }
  return null
}

function LedgerEntryRow({ account, isLiability, baseCurrency, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const typeLabel = ACCOUNT_TYPE_LABELS?.[account.type] || account.type
  const accentColor = TYPE_ACCENT[account.type] || TYPE_ACCENT.other
  const balance = Number(account.balance || 0)
  const displayCurrency = String(account.currency || 'GBP').toUpperCase()
  const excluded = account.include_in_net_worth === false
  const monthly = Number(account.monthly_contribution || 0)
  const rate = Number(account.annual_interest_rate_percent || 0)
  const rateLabel = RATE_LABEL[account.type] || 'Rate'
  const monthlyLabel = MONTHLY_LABEL[account.type] || 'Monthly'
  const foreignCurrency = displayCurrency !== (baseCurrency || 'GBP').toUpperCase()
  const hasNotes = account.notes && String(account.notes).trim().length > 0
  const staleness = accountStaleness(account.updated_at)

  return (
    <div
      onClick={onEdit}
      className={[
        'group relative flex items-center cursor-pointer transition-[background-color,opacity] duration-150',
        'border-b border-black/[.05] dark:border-white/[.05]',
        'hover:bg-black/[.025] dark:hover:bg-white/[.035]',
        excluded ? 'opacity-45' : '',
      ].join(' ')}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[2.5px] opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-r"
        style={{ background: accentColor }}
        aria-hidden="true"
      />

      {/* Zone 1: Identity */}
      <div className="flex-1 min-w-0 flex items-center gap-3.5 py-4 sm:py-[18px] pl-4 pr-3">
        <div
          className="shrink-0 w-[8px] h-[8px] rounded-full"
          style={{ background: accentColor, opacity: 0.9, marginTop: 1 }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[14px] sm:text-[14.5px] font-semibold text-ink dark:text-white leading-snug truncate">
              {account.name}
            </span>
            {excluded && (
              <span className="shrink-0 text-[10px] font-medium tracking-[.03em] px-1.5 py-0.5 rounded-full bg-black/[.045] dark:bg-white/[.07] text-ink-muted/55 dark:text-white/28">
                Excluded
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-muted/65 dark:text-white/40 leading-snug">
            {typeLabel}
            {foreignCurrency && (
              <>
                {' '}·{' '}
                <span className="font-medium tabular-nums">{displayCurrency}</span>
              </>
            )}
            {hasNotes && (
              <>
                {' '}· {String(account.notes).slice(0, 32)}
                {String(account.notes).length > 32 ? '…' : ''}
              </>
            )}
            {staleness && !excluded && (
              <span
                className="ml-1"
                style={{ color: staleness.state === 'stale' ? 'rgba(217,119,6,0.70)' : 'rgba(217,119,6,0.50)' }}
              >
                · Updated {staleness.days}d ago
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Zone 2: Monthly */}
      <div className="hidden sm:flex flex-col items-end w-[112px] shrink-0 py-4 sm:py-[18px] pr-4">
        {monthly > 0 ? (
          <>
            <span className="text-[13px] font-semibold tabular-nums text-ink dark:text-white leading-none">
              {fmtCurrencyCompact(monthly, displayCurrency)}
              <span className="text-[10px] font-normal text-ink-muted/45 dark:text-white/26">/mo</span>
            </span>
            <span className="mt-1 text-[10.5px] font-medium text-ink-muted/50 dark:text-white/32">
              {monthlyLabel}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-ink-muted/22 dark:text-white/14">—</span>
        )}
      </div>

      {/* Zone 3: Rate */}
      <div className="hidden sm:flex flex-col items-end w-[82px] shrink-0 py-4 sm:py-[18px] pr-4">
        {rate > 0 ? (
          <>
            <span className="text-[13px] font-semibold tabular-nums text-ink dark:text-white leading-none">
              {rate.toFixed(1)}%
            </span>
            <span className="mt-1 text-[10.5px] font-medium text-ink-muted/50 dark:text-white/32">
              {rateLabel}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-ink-muted/22 dark:text-white/14">—</span>
        )}
      </div>

      {/* Zone 4: Balance */}
      <div className="shrink-0 flex flex-col items-end w-[118px] sm:w-[138px] py-4 sm:py-[18px] pr-2">
        <span
          className={[
            'text-[15px] sm:text-[16px] font-semibold tabular-nums tracking-tight leading-none',
            isLiability ? 'text-loss dark:text-rose-400' : 'text-ink dark:text-white',
          ].join(' ')}
        >
          {isLiability ? '−' : ''}{fmtCurrency(balance, displayCurrency)}
        </span>
        {foreignCurrency && balance !== 0 && (
          <span className="mt-1 text-[10px] text-ink-muted/35 dark:text-white/20 tabular-nums">
            {displayCurrency}
          </span>
        )}
      </div>

      {/* Zone 5: Actions */}
      <div
        className={[
          'shrink-0 w-10 pr-2 relative opacity-0 group-hover:opacity-100 transition-opacity duration-150',
          menuOpen ? 'opacity-100' : '',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/[.05] dark:hover:bg-white/[.08] transition-colors text-ink-muted/45 dark:text-white/28"
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-8 z-20 w-36 rounded-2xl border border-black/[.07] dark:border-white/[.09] bg-white dark:bg-surface-dark-2 shadow-[0_8px_28px_rgba(0,0,0,0.13)] overflow-hidden">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onEdit() }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink dark:text-white hover:bg-black/[.04] dark:hover:bg-white/[.05] transition-colors"
                >
                  <Pencil size={13} className="opacity-55" /> Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onDelete() }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-loss dark:text-rose-400 hover:bg-loss-light/60 dark:hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 size={13} className="opacity-65" /> Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── WealthGroup ─────────────────────────────────── */

function WealthGroup({ group, baseCurrency, totalAssetsForPct, onEdit, onDelete, onAdd, nudge }) {
  const { label, accounts, subtotal, isLiability } = group
  if (!accounts.length) return null

  const allocationPct = !isLiability && totalAssetsForPct > 0
    ? (subtotal / totalAssetsForPct) * 100
    : null

  return (
    <div>
      <div className="flex items-center justify-between gap-4 pb-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="shrink-0 w-[3px] h-4 rounded-full"
            style={{ background: isLiability ? 'rgba(192,90,70,0.55)' : 'rgba(120,169,230,0.45)' }}
            aria-hidden="true"
          />
          <span className="text-[10.5px] font-semibold tracking-[.16em] uppercase text-ink-muted/65 dark:text-white/40">
            {label}
          </span>

          {allocationPct != null && allocationPct > 0.5 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums bg-black/[.04] dark:bg-white/[.07] text-ink-muted/60 dark:text-white/30">
              {allocationPct.toFixed(0)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={[
              'text-[14px] sm:text-[14.5px] font-bold tabular-nums tracking-tight',
              isLiability ? 'text-loss dark:text-rose-400' : 'text-ink dark:text-white',
            ].join(' ')}
          >
            {isLiability ? '−' : ''}{fmtCurrencyCompact(Math.abs(subtotal), baseCurrency)}
          </span>

          {onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="text-[11px] font-semibold text-accent hover:text-accent-dark dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border border-black/[.05] dark:border-white/[.06] bg-black/[.01] dark:bg-white/[.02]">
        {accounts.map((a) => (
          <LedgerEntryRow
            key={a.id}
            account={a}
            isLiability={isLiability}
            baseCurrency={baseCurrency}
            onEdit={() => onEdit(a)}
            onDelete={() => onDelete(a)}
          />
        ))}

        {nudge && (
          <button
            type="button"
            onClick={nudge.onClick}
            className="w-full text-left flex items-center gap-2.5 px-4 py-3 transition-opacity hover:opacity-85"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div
              className="shrink-0 w-[7px] h-[7px] rounded-full"
              style={{ background: nudge.dotColor || 'rgba(120,169,230,0.6)' }}
            />
            <span
              className="flex-1 min-w-0 text-[13px] font-medium"
              style={{ color: nudge.color || 'rgba(120,169,230,0.85)' }}
            >
              {nudge.label}
            </span>
            <ChevronRight
              size={12}
              className="shrink-0"
              style={{ color: nudge.color || 'rgba(120,169,230,0.85)', opacity: 0.5 }}
            />
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Column header ───────────────────────────────── */

function LedgerColumnHeader() {
  return (
    <div className="flex items-center pb-2.5 border-b border-black/[.05] dark:border-white/[.05]">
      <div className="flex-1 pl-[1.75rem]">
        <span className="text-[10px] font-semibold tracking-[.16em] uppercase text-ink-muted/40 dark:text-white/20">
          Account
        </span>
      </div>
      <div className="hidden sm:block w-[112px] shrink-0 text-right pr-4">
        <span className="text-[10px] font-semibold tracking-[.16em] uppercase text-ink-muted/40 dark:text-white/20">
          Monthly
        </span>
      </div>
      <div className="hidden sm:block w-[82px] shrink-0 text-right pr-4">
        <span className="text-[10px] font-semibold tracking-[.16em] uppercase text-ink-muted/40 dark:text-white/20">
          Rate
        </span>
      </div>
      <div className="w-[118px] sm:w-[138px] shrink-0 text-right pr-2">
        <span className="text-[10px] font-semibold tracking-[.16em] uppercase text-ink-muted/40 dark:text-white/20">
          Balance
        </span>
      </div>
      <div className="w-10 shrink-0" />
    </div>
  )
}

/* ── Main component ──────────────────────────────── */

export default function Accounts() {
  const { baseCurrency, showToast, setPage, bumpData, isPro } = useApp()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({...emptyForm})
  const [saving, setSaving] = useState(false)
  const [snaps, setSnaps] = useState([])
  const snapshotsRef = useRef(null)
  const [snapsLoading, setSnapsLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expandedSnap, setExpandedSnap] = useState(null)
  const [confirmState, setConfirmState] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [justRecorded, setJustRecorded] = useState(false)
  const cancelledRef = useRef(false)
  useEffect(()=>{cancelledRef.current=false;return()=>{cancelledRef.current=true}},[])

  const FREE_ACCOUNT_LIMIT = 3
  const accountCount = accounts.length
  const accountLimitReached = !isPro && accountCount >= FREE_ACCOUNT_LIMIT
  const usage = useMemo(()=>{if(isPro)return null;return{used:accountCount,limit:FREE_ACCOUNT_LIMIT,pct:clamp((accountCount/FREE_ACCOUNT_LIMIT)*100,0,100)}},[isPro,accountCount])

  const goUpgrade = useCallback(()=>{try{localStorage.setItem('upgrade_reason','account_limit')}catch{};track('upgrade_clicked',{page:'accounts',source:'account_limit'});setPage('upgrade')},[setPage])

  useEffect(()=>{track('page_view',{page:'accounts'})},[])

  useEffect(()=>{
    let c=false; setLoading(true)
    ;(async()=>{try{const r=asArray(await api('/accounts'));if(!c)setAccounts(r)}catch(e){if(!c){showToast?.(e?.message||'Failed to load accounts','error');setAccounts([])}}finally{if(!c)setLoading(false)}})()
    return()=>{c=true}
  },[])

  const loadSnaps = useCallback(async()=>{
    setSnapsLoading(true)
    try{const r=await api('/snapshots',{method:'GET'});if(!cancelledRef.current)setSnaps(asArray(r))}
    catch{if(!cancelledRef.current)setSnaps([])}
    finally{if(!cancelledRef.current)setSnapsLoading(false)}
  },[])

  useEffect(()=>{if(historyOpen&&!snaps.length)loadSnaps()},[historyOpen,snaps.length,loadSnaps])
  useEffect(()=>{ loadSnaps() },[loadSnaps])

  const recordSnapshot = useCallback(async()=>{
    try{await api('/snapshots',{method:'POST'});showToast?.('Net worth recorded!');setJustRecorded(true);await loadSnaps();bumpData?.()}
    catch(e){showToast?.(e?.message||'Failed to record','error')}
  },[showToast,loadSnaps,bumpData])

  const deleteSnap = useCallback(async(id)=>{
    setConfirmState({title:'Delete this record?',message:'This snapshot will be permanently removed.',confirmLabel:'Delete',onConfirm:async()=>{
      setConfirmLoading(true)
      try{await api(`/snapshots/${id}`,{method:'DELETE'});showToast?.('Deleted');setExpandedSnap(p=>p===id?null:p);setConfirmState(null);await loadSnaps();bumpData?.()}
      catch(e){showToast?.(e?.message||'Delete failed','error')}
      finally{setConfirmLoading(false)}
    }})
  },[showToast,loadSnaps,bumpData])

  const sortedSnaps = useMemo(()=>[...snaps].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),[snaps])
  const snapCurrency = (sortedSnaps[0]?.base_currency||baseCurrency||'GBP').toUpperCase()

  const latestSnapshot = sortedSnaps[0] || null
  const latestSnapshotFreshness = getSnapshotFreshnessState(latestSnapshot?.created_at)

  const {assetsTotal,liabilitiesTotal,netPosition} = useMemo(()=>{
    const at=accounts.filter(a=>!LIABILITY_TYPES.has(a.type)&&a.include_in_net_worth!==false).reduce((s,a)=>s+(Number(a.balance)||0),0)
    const lt=accounts.filter(a=>LIABILITY_TYPES.has(a.type)).reduce((s,a)=>s+(Number(a.balance)||0),0)
    return{assetsTotal:at,liabilitiesTotal:lt,netPosition:at-lt}
  },[accounts])

  const totalMonthlyContribs = useMemo(
    () => accounts.reduce((sum, a) => sum + Number(a.monthly_contribution || 0), 0),
    [accounts]
  )

  const totalMonthlyContributions = useMemo(() => {
    return accounts
      .filter(a => !LIABILITY_TYPES.has(a.type) && a.include_in_net_worth !== false)
      .reduce((sum, a) => sum + Math.max(0, Number(a.monthly_contribution || 0)), 0)
  }, [accounts])

  const wealthGroups = useMemo(()=>WEALTH_GROUPS.map(g=>{
    const ga=accounts.filter(a=>g.types.includes(a.type))
    const sub=ga.reduce((sum,a)=>{if(!g.isLiability&&a.include_in_net_worth===false)return sum;return sum+(Number(a.balance)||0)},0)
    return{...g,accounts:ga,subtotal:sub}
  }).filter(g=>g.accounts.length>0),[accounts])

  const donutData = useMemo(()=>{
    const map=new Map()
    for(const a of accounts)map.set(a.type||'other',(map.get(a.type||'other')||0)+1)
    return Array.from(map.entries()).map(([type,count])=>({type,count,label:ACCOUNT_TYPE_LABELS?.[type]||type})).sort((a,b)=>b.count-a.count)
  },[accounts])

  const openAdd = (defaultType) => { setEditing(null); setForm({...emptyForm,type:defaultType||'bank',currency:baseCurrency||'GBP'}); setModal(true) }
  const openEdit = (a) => { setEditing(a.id); setForm({name:a.name||'',type:a.type||'bank',currency:(a.currency||'GBP').toUpperCase(),balance:String(a.balance??''),include_in_net_worth:!!a.include_in_net_worth,notes:a.notes||'',monthly_contribution:String(a.monthly_contribution??''),annual_interest_rate_percent:String(a.annual_interest_rate_percent??''),_nameHint:''}); setModal(true) }

  const save = async() => {
    if(!form.name.trim()){showToast?.('Name is required','error');return}
    const body={name:form.name.trim(),type:form.type,currency:(form.currency||'GBP').toUpperCase(),balance:toNumber(form.balance,0),include_in_net_worth:!!form.include_in_net_worth,notes:form.notes?.trim()||null,monthly_contribution:toNumber(form.monthly_contribution,0),annual_interest_rate_percent:toNumber(form.annual_interest_rate_percent,0)}
    setSaving(true)
    try {
      if(editing){const eid=editing;await api(`/accounts/${eid}`,{method:'PUT',body});setAccounts(prev=>prev.map(a=>a.id===eid?{...a,...body}:a));invalidatePath('/accounts');invalidatePath('/dashboard');invalidatePath('/dashboard?range=3M');bumpData?.();track('account_updated',{page:'accounts',entityType:'account',entityId:eid,account_type:body.type,currency:body.currency,source:'accounts_edit'});showToast?.('Account updated');setModal(false);setEditing(null);return}
      if(accountLimitReached){setModal(false);goUpgrade();return}
      const created=await api('/accounts',{method:'POST',body});const ca={...body,...(created||{}),id:created?.id??crypto.randomUUID()};setAccounts(prev=>[ca,...prev]);invalidatePath('/accounts');invalidatePath('/dashboard');invalidatePath('/dashboard?range=3M');bumpData?.();showToast?.('Account added');track('account_added',{page:'accounts',entityType:'account',entityId:ca.id,account_type:body.type,currency:body.currency,source:'accounts_create'});setModal(false);setEditing(null)
    } catch(e) {if(e?.status===403){setModal(false);goUpgrade();return};showToast?.(e?.message||'Save failed','error')}
    finally{setSaving(false)}
  }

  const del = async(a) => {
    setConfirmState({title:`Delete "${a.name}"?`,message:'This account and its data will be permanently removed.',confirmLabel:'Delete',onConfirm:async()=>{
      setConfirmLoading(true);setSaving(true)
      try{await api(`/accounts/${a.id}`,{method:'DELETE'});setAccounts(prev=>prev.filter(x=>x.id!==a.id));invalidatePath('/accounts');invalidatePath('/dashboard');invalidatePath('/dashboard?range=3M');bumpData?.();track('account_deleted',{page:'accounts',entityType:'account',entityId:a.id,account_type:a.type,currency:a.currency,source:'accounts_delete'});showToast?.('Deleted');setConfirmState(null)}
      catch(e){showToast?.(e?.message||'Delete failed','error')}
      finally{setSaving(false);setConfirmLoading(false)}
    }})
  }

  const openHistoryFromHeader = useCallback(() => {
    setHistoryOpen(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        snapshotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }, [])

  const inp='w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const lbl='block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2'

  if(loading){return(
    <div className="animate-fade-in">
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-6 pt-9 pb-9 sm:px-10" style={{background:'#141A26'}}>
        <div className="h-2.5 w-20 rounded skeleton opacity-20 mb-3"/><div className="h-12 w-52 rounded-lg skeleton opacity-25 mb-7"/>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-xl">{[1,2,3,4].map(i=><div key={i}><div className="h-2 w-16 rounded skeleton opacity-15 mb-2"/><div className="h-6 w-24 rounded skeleton opacity-20"/></div>)}</div>
      </div>
      <div className="pt-9 space-y-10">{[1,2].map(g=>(
        <div key={g}><div className="flex items-center gap-3 pb-3"><div className="w-[3px] h-4 rounded-full skeleton"/><div className="h-3.5 w-36 rounded skeleton"/><div className="ml-auto h-4 w-16 rounded skeleton"/></div>
        <div className="h-px bg-black/[.06] dark:bg-white/[.07]"/>
        {[1,2,3].map(r=><div key={r} className="flex items-center py-5 border-b border-black/[.05] dark:border-white/[.05]"><div className="w-2 h-2 rounded-full skeleton mx-4 shrink-0"/><div className="flex-1 space-y-1.5"><div className="h-4 w-44 rounded skeleton"/><div className="h-3 w-28 rounded skeleton"/></div><div className="hidden sm:block w-20 h-4 rounded skeleton mr-4"/><div className="hidden sm:block w-14 h-4 rounded skeleton mr-4"/><div className="w-24 h-5 rounded skeleton mr-2"/><div className="w-10"/></div>)}
        </div>
      ))}</div>
    </div>
  )}

  const hasAccounts = accounts.length > 0

  return (
    <div className="animate-page-in">
      <h1 className="text-sm font-semibold tracking-[.08em] uppercase text-ink-muted/40 dark:text-white/22">Accounts</h1>

            {/* SCENE 1: HEADER */}
            <div
        className="-mx-4 sm:-mx-6 lg:-mx-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0A0F1A 0%, #141A26 50%, #0F141F 100%)' }}
      >
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-12 w-[340px] h-[340px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(120,169,230,0.06) 0%, transparent 60%)' }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-14 -left-8 w-[240px] h-[240px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 60%)' }}
        />

<div className="relative px-6 pt-8 pb-5 sm:px-10 sm:pt-9 sm:pb-6">
<div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
  <div className="min-w-0 flex-1 max-w-[58rem]">
    <div
      className="text-[10px] font-semibold tracking-[.18em] uppercase mb-3"
      style={{ color: 'rgba(255,255,255,0.25)' }}
    >
      Wealth ledger · {baseCurrency}
    </div>

    {hasAccounts ? (
      <>
        <div className="hero-number text-white leading-none">
          {fmtCurrencyCompact(netPosition, baseCurrency)}
        </div>

        <div className="mt-2 text-[12px] leading-none" style={{ color: 'rgba(255,255,255,0.22)' }}>
          Net position
          {liabilitiesTotal > 0 && (
            <span style={{ color: 'rgba(255,255,255,0.18)' }}>
              {' '}· {fmtCurrencyCompact(assetsTotal, baseCurrency)} assets − {fmtCurrencyCompact(liabilitiesTotal, baseCurrency)} liabilities
            </span>
          )}
        </div>
      </>
    ) : (
      <div className="text-[1.5rem] font-semibold text-white/40">No accounts yet</div>
    )}
  </div>

  <div className="shrink-0 w-full sm:w-auto">
  <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2 p-1.5 rounded-[22px] border border-white/[.08] bg-white/[.03] backdrop-blur-xl w-full sm:w-auto">
    <button
      onClick={() => {
        if (historyOpen) setHistoryOpen(false)
        else openHistoryFromHeader()
      }}
      className="shrink-0 inline-flex items-center justify-center gap-1.5 text-[11.5px] sm:text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl text-white/75 hover:text-white hover:bg-white/[.06] transition-colors whitespace-nowrap"
      type="button"
    >
      <Clock size={12} className="opacity-70" />
      History
      <ChevronDown size={11} className={`opacity-50 transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`} />
    </button>

    <button
      onClick={recordSnapshot}
      disabled={saving || !hasAccounts}
      className="shrink-0 inline-flex items-center justify-center gap-1.5 text-[11.5px] sm:text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl text-white/75 hover:text-white hover:bg-white/[.06] transition-colors whitespace-nowrap"
      type="button"
    >
      <Camera size={12} className="opacity-70" />
      Record
    </button>

    <button
      onClick={() => { if (accountLimitReached) return goUpgrade(); openAdd() }}
      className={[
        'flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 text-[12px] sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-[18px] transition-all active:scale-[.97] whitespace-nowrap',
        accountLimitReached
          ? 'bg-gradient-to-r from-accent to-accent-dark text-white hover:opacity-90'
          : 'bg-white/[.09] border border-white/[.13] text-white hover:bg-white/[.14]',
      ].join(' ')}
      disabled={saving}
      type="button"
    >
      {accountLimitReached ? <><Crown size={13} /> Upgrade</> : <><Plus size={14} /> Add account</>}
    </button>
  </div>
</div>
</div>

          {hasAccounts && (
  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-5 max-w-[58rem]">
    {[
  { label: 'Total assets', value: fmtCurrencyCompact(assetsTotal, baseCurrency), show: true },
  { label: 'Liabilities', value: '−' + fmtCurrencyCompact(liabilitiesTotal, baseCurrency), show: liabilitiesTotal > 0, color: 'rgba(192,90,70,0.82)' },
  {
    label: 'Monthly contributions',
    value: totalMonthlyContributions > 0 ? `${fmtCurrencyCompact(totalMonthlyContributions, baseCurrency)}/mo` : '—',
    show: true,
  },
  {
    label: 'Last recorded',
    value: latestSnapshot ? fmtDate(latestSnapshot.created_at) : null,
    show: true,
    empty: 'Not yet',
    freshness: latestSnapshotFreshness.state,
  },
].filter(s => s.show).map(stat => (
  <div key={stat.label}>
    <div
      className="text-[9.5px] font-semibold tracking-[.13em] uppercase mb-1.5"
      style={{ color: 'rgba(255,255,255,0.20)' }}
    >
      {stat.label}
    </div>

    <div
      className="text-[1.22rem] sm:text-[1.28rem] font-semibold tabular-nums tracking-tight leading-tight"
      style={{
        color:
          stat.freshness === 'stale'
            ? 'rgba(217,119,6,0.82)'
            : stat.freshness === 'aging'
            ? 'rgba(217,119,6,0.76)'
            : stat.color || 'rgba(255,255,255,0.88)'
      }}
    >
      {stat.value || (
        <span
          className="text-sm font-normal"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          {stat.empty}
        </span>
      )}
    </div>
  </div>
))}
  </div>
)}

          {!isPro && usage && !accountLimitReached && hasAccounts && (
            <div className="mt-5 flex items-center gap-3">
              <div className="h-1 w-20 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.10)' }}>
                <div className="h-full rounded-full bg-accent" style={{ width: `${usage.pct}%` }} />
              </div>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
                {usage.used} of {usage.limit} free · <button onClick={goUpgrade} className="underline" type="button">Upgrade for unlimited</button>
              </span>
            </div>
          )}

          {accountLimitReached && (
            <div className="mt-4 text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Free limit reached · <button onClick={goUpgrade} className="font-semibold underline" style={{ color: 'var(--gold)' }} type="button">Upgrade for unlimited accounts</button>
            </div>
          )}
          <div
  className="mt-5 h-px"
  style={{
    background:
      'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 68%, transparent 100%)',
  }}
/>
        </div>
      </div>

      {hasAccounts && latestSnapshotFreshness.state === 'stale' && (
            <div
              className="mt-5 inline-flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl"
              style={{ background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.18)', color: 'rgba(217,119,6,0.88)' }}
            >
              <span className="mt-[2px] w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(217,119,6,0.88)' }} />
              <span className="text-[11px] font-medium leading-relaxed">
                Last snapshot was {latestSnapshotFreshness.days} days ago — figures may not reflect current balances.
              </span>
            </div>
          )}

      {/* SCENE 2: LEDGER */}
      {!hasAccounts ? (
        <div className="pt-14 pb-6 text-center max-w-xs mx-auto">
          <Landmark size={24} className="text-ink-muted/20 dark:text-white/12 mx-auto mb-4"/>
          <div className="text-sm font-semibold text-ink dark:text-white mb-1.5">Add your first account</div>
          <p className="text-xs text-ink-muted/55 dark:text-white/30 leading-relaxed mb-5">ISA, pension, bank, property, crypto — anything that counts toward your net worth.</p>
          <button onClick={()=>{if(accountLimitReached)return goUpgrade();openAdd()}} className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all" type="button"><Plus size={14}/> Add account</button>
        </div>
      ) : (
        <div className="pt-5">
  <LedgerColumnHeader />
  <div className="mt-5 space-y-9">
            {wealthGroups.map(g=>{
              // Contextual nudge — at most 1 per group, priority order
              let nudge = null

              if (g.key === 'liabilities') {
                const first = g.accounts.find(a => a.type === 'mortgage' && Number(a.balance || 0) > 0)
                if (first) nudge = {
                  label: 'Model overpayment savings in Decisions',
                  onClick: () => setPage('decisions'),
                  color: 'rgba(192,90,70,0.75)',
                  dotColor: 'rgba(192,90,70,0.50)',
                }
              }

              if (g.key === 'investments' && !nudge) {
                const first = g.accounts.find(a => (a.type === 'isa' || a.type === 'investment') && Number(a.monthly_contribution || 0) === 0)
                if (first) nudge = {
                  label: 'Add a monthly contribution to improve your forecast',
                  onClick: () => openEdit(first),
                  color: 'rgba(120,169,230,0.80)',
                  dotColor: 'rgba(120,169,230,0.50)',
                }
              }

              if (g.key === 'investments' && !nudge) {
                const first = g.accounts.find(a => (a.type === 'isa' || a.type === 'investment') && Number(a.annual_interest_rate_percent || 0) === 0)
                if (first) nudge = {
                  label: 'Add an expected return to improve your forecast',
                  onClick: () => openEdit(first),
                  color: 'rgba(120,169,230,0.80)',
                  dotColor: 'rgba(120,169,230,0.50)',
                }
              }

              if (g.key === 'pensions' && !nudge) {
                const first = g.accounts.find(a => a.type === 'sipp' && Number(a.monthly_contribution || 0) === 0)
                if (first) nudge = {
                  label: 'Add a pension contribution to your forecast',
                  onClick: () => openEdit(first),
                  color: 'rgba(124,58,237,0.75)',
                  dotColor: 'rgba(124,58,237,0.50)',
                }
              }

              if (g.key === 'pensions' && !nudge) {
                const first = g.accounts.find(a => a.type === 'sipp' && Number(a.annual_interest_rate_percent || 0) === 0)
                if (first) nudge = {
                  label: 'Add an expected growth rate to improve your forecast',
                  onClick: () => openEdit(first),
                  color: 'rgba(124,58,237,0.75)',
                  dotColor: 'rgba(124,58,237,0.50)',
                }
              }

              if (!nudge) {
                const first = g.accounts.find(a => a.include_in_net_worth === false)
                if (first) nudge = {
                  label: 'This account is excluded from net worth',
                  onClick: () => openEdit(first),
                  color: 'rgba(107,114,128,0.70)',
                  dotColor: 'rgba(107,114,128,0.45)',
                }
              }

              return (
                <WealthGroup key={g.key} group={g} baseCurrency={baseCurrency} totalAssetsForPct={assetsTotal}
                  onEdit={openEdit} onDelete={del}
                  onAdd={!g.isLiability&&!accountLimitReached?()=>openAdd(g.types[0]):undefined}
                  nudge={nudge}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* SCENE 3: COMPOSITION */}
      {hasAccounts&&donutData.length>0&&(
        <div className="mt-10 pt-6 border-t border-black/[.06] dark:border-white/[.07]">
          <div className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-ink-muted/45 dark:text-white/25 mb-5">Composition</div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {donutData.map(d=>(
              <div key={d.type} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:TYPE_ACCENT[d.type]||TYPE_ACCENT.other}}/>
                <span className="text-sm text-ink dark:text-white/70">{d.label}</span>
                <span className="text-[12px] text-ink-muted/55 dark:text-white/38 tabular-nums">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SCENE 4: SNAPSHOTS */}
      <div
  ref={snapshotsRef}
  className="mt-8 pt-6 border-t border-black/[.06] dark:border-white/[.07] pb-4"
>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10.5px] font-semibold tracking-[.14em] uppercase text-ink-muted/45 dark:text-white/25">Snapshots</span>
            {sortedSnaps[0]?(
              <span className="text-xs text-ink-muted/65 dark:text-white/45">Last: <span className="font-semibold text-ink dark:text-white">{fmtDate(sortedSnaps[0].created_at)}</span>{sortedSnaps.length>1&&<> · {sortedSnaps.length} total</>}</span>
            ):(
              <span className="text-xs text-ink-muted/60 dark:text-white/38">Record to start tracking net worth over time</span>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {latestSnapshotFreshness.state === 'stale' && !justRecorded && (
              <span className="text-[10.5px] font-medium text-amber-600/80 dark:text-amber-400/65">
                Over 30 days since last record.
              </span>
            )}
            {justRecorded && (
              <button
                type="button"
                onClick={() => setPage('plan')}
                className="text-[11px] font-semibold text-accent hover:text-accent-dark dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                View your updated plan →
              </button>
            )}
          </div>
        </div>

        {historyOpen&&(
          <div className="mt-4 rounded-2xl border border-black/[.06] dark:border-white/[.07] overflow-hidden">
            {snapsLoading?(<div className="p-4 space-y-2">{[1,2,3].map(i=><div key={i} className="h-10 rounded-xl skeleton"/>)}</div>)
            :sortedSnaps.length===0?(<div className="p-4 text-sm text-ink-muted/55 dark:text-white/30">No snapshots yet.</div>)
            :(<div className="divide-y divide-black/[.04] dark:divide-white/[.04]">
              {sortedSnaps.map((s,idx)=>{
                const prev=sortedSnaps[idx+1],v=snapBaseTotal(s),pv=prev?snapBaseTotal(prev):null
                const d=v!=null&&pv!=null?v-pv:null,pct=d!=null&&pv!=null&&pv!==0?(d/Math.abs(pv))*100:null
                const isOpen=expandedSnap===s.id,hasBreakdown=Array.isArray(s.breakdown)&&s.breakdown.length>0
                const cur=(s.base_currency||snapCurrency||'GBP').toUpperCase()
                return(
                  <div key={s.id}>
                    <button type="button" onClick={()=>setExpandedSnap(p=>p===s.id?null:s.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-black/[.02] dark:hover:bg-white/[.02] transition-colors text-left">
                      <div className="min-w-0"><div className="text-sm font-semibold text-ink dark:text-white">{fmtDate(s.created_at)}</div><div className="text-xs text-ink-muted/50 dark:text-white/30">{idx===sortedSnaps.length-1?'First snapshot':'vs. previous'}</div></div>
                      <div className="flex items-center gap-3 shrink-0">
                        {d!=null&&pct!=null?<ChangePill change={d} changePct={pct} currency={cur} size="sm"/>:<span className="text-xs text-ink-muted/35 dark:text-white/20">—</span>}
                        <ChevronDown size={12} className={`opacity-40 transition-transform duration-200 ${isOpen?'rotate-180':''}`}/>
                      </div>
                    </button>
                    {isOpen&&(
                      <div className="px-4 pb-4 pt-2 bg-black/[.015] dark:bg-white/[.02] border-t border-black/[.04] dark:border-white/[.04]">
                        <div className="flex items-center justify-between gap-3 mb-3"><div className="text-xs text-ink-muted/55 dark:text-white/32">{hasBreakdown?'Breakdown':'Snapshot'}</div><button type="button" onClick={()=>deleteSnap(s.id)} className="text-xs font-semibold text-loss/70 hover:text-loss dark:text-rose-400/70 dark:hover:text-rose-400 transition-colors">Delete</button></div>
                        {hasBreakdown&&(<div className="space-y-2">{s.breakdown.map(b=>(<div key={b.id||`${b.name}-${b.currency}`} className="flex justify-between items-center text-sm"><span className="text-ink-muted/60 dark:text-white/45">{b.name} <span className="text-ink-muted/40 dark:text-white/25">({b.currency})</span></span><span className="text-ink dark:text-white font-medium tabular-nums">{fmtCurrency(Number.isFinite(Number(b.value_base))?Number(b.value_base):0,cur)}</span></div>))}</div>)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>)}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={()=>(!saving?setModal(false):null)} title={editing?'Edit account':'Add account'}>
        <form onSubmit={e=>{e.preventDefault();save()}} className="space-y-4">
          <div><label className={lbl}>Name</label><input className={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder={accountNamePlaceholder(form?.type)}/><p className="text-[11px] text-ink-muted/50 dark:text-white/25 mt-1">Use a name you'll recognise later.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Type</label><select className={inp} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{TYPES.map(t=><option key={t} value={t}>{ACCOUNT_TYPE_LABELS?.[t]||t}</option>)}</select></div>
            <div><label className={lbl}>Currency</label><select className={inp} value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>{CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div><label className={lbl}>Balance</label><input className={inp} value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))} inputMode="decimal" placeholder="e.g. 12,500"/></div>
          <div className="flex items-center justify-between gap-3"><label className="text-sm font-semibold text-ink dark:text-white">Include in net worth</label><input type="checkbox" checked={!!form.include_in_net_worth} onChange={e=>setForm(f=>({...f,include_in_net_worth:e.target.checked}))} className="h-5 w-5 rounded border-black/[.20] dark:border-white/[.20]"/></div>
          <div><label className={lbl}>Notes (optional)</label><textarea className={inp} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Optional notes about this account"/></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Monthly contribution (optional)</label><input className={inp} value={form.monthly_contribution} onChange={e=>setForm(f=>({...f,monthly_contribution:e.target.value}))} inputMode="decimal" placeholder="e.g. 500"/></div>
            <div><label className={lbl}>Expected annual return / rate % (optional)</label><input className={inp} value={form.annual_interest_rate_percent} onChange={e=>setForm(f=>({...f,annual_interest_rate_percent:e.target.value}))} inputMode="decimal" placeholder="e.g. 5.2"/></div>
          </div>
          <div className="sticky bottom-0 z-10 -mx-5 sm:-mx-7 mt-2 px-5 sm:px-7 pt-3 pb-1 bg-white/95 dark:bg-surface-dark-2/95 backdrop-blur border-t border-black/[.06] dark:border-white/[.07] flex items-center justify-end gap-2">
            <button type="button" className="px-4 py-3 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors" onClick={()=>setModal(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="px-5 py-3 rounded-2xl text-sm font-semibold bg-accent text-white hover:bg-accent-dark transition-colors disabled:opacity-60" disabled={saving}>{saving?'Saving…':editing?'Update account':'Add account'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmState} title={confirmState?.title} message={confirmState?.message} confirmLabel={confirmState?.confirmLabel||'Delete'} destructive loading={confirmLoading} onConfirm={confirmState?.onConfirm} onCancel={()=>{setConfirmState(null);setConfirmLoading(false)}}/>
    </div>
  )
}