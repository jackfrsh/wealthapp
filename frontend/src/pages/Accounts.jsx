// frontend/src/pages/Accounts.jsx
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import ChangePill from '../components/ChangePill'
import { track } from '../track'
import UpgradeButton from '../components/UpgradeButton'
import { fmtCurrency, fmtCurrencyCompact, fmtDate, ACCOUNT_TYPE_LABELS, CURRENCIES } from '../utils'
import {
  Plus,
  Pencil,
  Trash2,
  Settings,
  Camera,
  ChevronDown,
  Clock,
  Crown,
  Sparkles,
  Landmark,
  Shield,
  Building2,
  Bitcoin,
  TrendingUp,
  Home as HomeIcon,
  Hammer,
  CreditCard,
  Package,
} from 'lucide-react'

const TYPES = ['bank', 'isa', 'sipp', 'crypto', 'investment', 'property', 'mortgage', 'loan', 'other']

const TYPE_ICON = {
  bank: Landmark,
  isa: Shield,
  sipp: Building2,
  crypto: Bitcoin,
  investment: TrendingUp,
  property: HomeIcon,
  mortgage: Hammer,
  loan: CreditCard,
  other: Package,
}

const emptyForm = {
  name: '',
  type: 'bank',
  currency: 'GBP',
  balance: '',
  include_in_net_worth: true,
  notes: '',
  monthly_contribution: '',
  annual_interest_rate_percent: '',
}

function accountNamePlaceholder(type) {
  switch (type) {
    case 'bank':
      return 'e.g. Barclays Current Account'
    case 'isa':
      return 'e.g. Vanguard Stocks & Shares ISA'
    case 'sipp':
      return 'e.g. Pension / SIPP'
    case 'investment':
      return 'e.g. Trading 212 Portfolio'
    case 'crypto':
      return 'e.g. Coinbase'
    case 'property':
      return 'e.g. Home (estimated value)'
    case 'mortgage':
      return 'e.g. Mortgage balance'
    case 'loan':
      return 'e.g. Car loan'
    default:
      return 'e.g. Barclays Current Account'
  }
}

function toNumber(input, fallback = 0) {
  const s = String(input ?? '').trim()
  if (!s) return fallback
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function snapBaseTotal(s) {
  if (!s) return null
  const n = Number(s.total_base)
  return Number.isFinite(n) ? n : null
}

function asArray(v) {
  return Array.isArray(v) ? v : []
}

/**
 * ✅ Apple-grade chart isolation:
 * - NO top-level recharts import (prevents vendor-charts bundle executing on page load)
 * - dynamic import after mount
 * - hard fallback if charts throw or fail to load
 */
function DonutChart({ enabled, donutData, donutFills, donutStroke }) {
  const [lib, setLib] = useState(null)
  const [failed, setFailed] = useState(false)

  // only attempt once per mount when enabled turns true
  useEffect(() => {
    let cancelled = false
    if (!enabled || failed || lib) return

    ;(async () => {
      try {
        const mod = await import('recharts')
        if (cancelled) return
        setLib(mod)
      } catch (e) {
        if (cancelled) return
        console.error('Charts bundle failed to load:', e)
        setFailed(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, failed, lib])

  // hard fallback placeholder
  if (!enabled || failed || !lib || !donutData?.length) {
    return (
      <div className="w-full h-full rounded-3xl bg-black/[.02] dark:bg-white/[.04] border border-black/[.06] dark:border-white/[.08]" />
    )
  }

  const { ResponsiveContainer, PieChart, Pie, Cell } = lib

  // Extra guard: chart render can still throw in Safari with ResizeObserver/0-size timing.
  try {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={donutData}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke={donutStroke}
            strokeWidth={1}
            isAnimationActive={false}
          >
            {donutData.map((_, i) => (
              <Cell key={i} fill={donutFills[i % donutFills.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    )
  } catch (e) {
    console.error('Charts render crashed:', e)
    return (
      <div className="w-full h-full rounded-3xl bg-black/[.02] dark:bg-white/[.04] border border-black/[.06] dark:border-white/[.08]" />
    )
  }
}

export default function Accounts() {
  const { baseCurrency, showToast, setPage, bumpData, isPro, dark } = useApp()

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const [snaps, setSnaps] = useState([])
  const [snapsLoading, setSnapsLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expandedSnap, setExpandedSnap] = useState(null)

  const [confirmState, setConfirmState] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // ✅ only allow chart loading after first paint
  const [chartsReady, setChartsReady] = useState(false)
  useEffect(() => setChartsReady(true), [])

  const cancelledRef = useRef(false)
  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const FREE_ACCOUNT_LIMIT = 3
  const accountCount = accounts.length
  const accountLimitReached = !isPro && accountCount >= FREE_ACCOUNT_LIMIT

  const usage = useMemo(() => {
    if (isPro) return null
    const used = accountCount
    const limit = FREE_ACCOUNT_LIMIT
    const pct = clamp((used / limit) * 100, 0, 100)
    return { used, limit, pct }
  }, [isPro, accountCount])

  const goUpgrade = useCallback(() => {
    try {
      localStorage.setItem('upgrade_reason', 'account_limit')
    } catch {}
    setPage('upgrade')
  }, [setPage])

  const load = useCallback(async () => {
    // Only show the full-page loading state on the first load
    const isFirstLoad = accounts.length === 0
    if (isFirstLoad) setLoading(true)
  
    try {
      const res = await api('/accounts')
      if (cancelledRef.current) return
      setAccounts(asArray(res))
    } catch (e) {
      if (cancelledRef.current) return
      console.error(e)
      showToast?.(e?.message || 'Failed to load accounts', 'error')
      // Only wipe accounts if we had none; otherwise keep the last known good UI
      if (accounts.length === 0) setAccounts([])
    } finally {
      if (!cancelledRef.current && isFirstLoad) setLoading(false)
    }
  }, [showToast, accounts.length])

  useEffect(() => {
    load()
  }, [load])

  const loadSnaps = useCallback(async () => {
    setSnapsLoading(true)
    try {
      const res = await api('/snapshots', { method: 'GET' })
      if (cancelledRef.current) return
      setSnaps(asArray(res))
    } catch (e) {
      if (cancelledRef.current) return
      console.error(e)
      setSnaps([])
    } finally {
      if (!cancelledRef.current) setSnapsLoading(false)
    }
  }, [])

  const totalMonthlyContribution = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const v =
        a?.monthly_contribution ??
        a?.monthlyContribution ??
        a?.monthly ??
        a?.contribution_monthly ??
        0
      return sum + (Number(v) || 0)
    }, 0)
  }, [accounts])

  useEffect(() => {
    if (!historyOpen) return
    if (snaps.length) return
    loadSnaps()
  }, [historyOpen, snaps.length, loadSnaps])

  const recordSnapshot = useCallback(async () => {
    try {
      await api('/snapshots', { method: 'POST' })
      showToast?.('Net worth recorded!')
      await loadSnaps()
      bumpData?.()
    } catch (e) {
      showToast?.(e?.message || 'Failed to record', 'error')
    }
  }, [showToast, loadSnaps, bumpData])

  const deleteSnap = useCallback(
    async (id) => {
      setConfirmState({
        title: 'Delete this record?',
        message: 'This snapshot will be permanently removed.',
        confirmLabel: 'Delete',
        onConfirm: async () => {
          setConfirmLoading(true)
          try {
            await api(`/snapshots/${id}`, { method: 'DELETE' })
            showToast?.('Deleted')
            setExpandedSnap((prev) => (prev === id ? null : prev))
            setConfirmState(null)
            await loadSnaps()
            bumpData?.()
          } catch (e) {
            showToast?.(e?.message || 'Delete failed', 'error')
          } finally {
            setConfirmLoading(false)
          }
        },
      })
    },
    [showToast, loadSnaps, bumpData]
  )

  const sortedSnaps = useMemo(() => {
    return [...snaps].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [snaps])

  const latestSnap = sortedSnaps[0] || null
  const snapCurrency = (latestSnap?.base_currency || baseCurrency || 'GBP').toUpperCase()

  const donutData = useMemo(() => {
    const map = new Map()
    for (const a of accounts) {
      const t = a?.type || 'other'
      map.set(t, (map.get(t) || 0) + 1)
    }
    const total = accounts.length || 1
    const arr = Array.from(map.entries()).map(([type, count]) => ({
      type,
      count,
      value: count,
      pct: (count / total) * 100,
      label: ACCOUNT_TYPE_LABELS?.[type] || type,
    }))
    arr.sort((a, b) => b.count - a.count)
    return arr
  }, [accounts])

  const donutStroke = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'

  const donutFills = useMemo(() => {
    return dark
      ? [
          'rgba(255,255,255,0.70)',
          'rgba(255,255,255,0.45)',
          'rgba(255,255,255,0.28)',
          'rgba(255,255,255,0.18)',
          'rgba(255,255,255,0.12)',
          'rgba(255,255,255,0.08)',
          'rgba(255,255,255,0.06)',
          'rgba(255,255,255,0.05)',
        ]
      : [
          'rgba(0,0,0,0.65)',
          'rgba(0,0,0,0.48)',
          'rgba(0,0,0,0.36)',
          'rgba(0,0,0,0.26)',
          'rgba(0,0,0,0.18)',
          'rgba(0,0,0,0.13)',
          'rgba(0,0,0,0.10)',
          'rgba(0,0,0,0.08)',
        ]
  }, [dark])

  const colorByType = useMemo(() => {
    const m = new Map()
    donutData.forEach((d, i) => m.set(d.type, donutFills[i % donutFills.length]))
    return m
  }, [donutData, donutFills])

  const openAdd = () => {
    setEditing(null)
    setForm({
      ...emptyForm,
      type: 'bank',                 // explicit default
      currency: baseCurrency || 'GBP',
    })
    setModal(true)
  }

  const openEdit = (a) => {
    setEditing(a.id)
    setForm({
      name: a.name || '',
      type: a.type || 'bank',
      currency: (a.currency || 'GBP').toUpperCase(),
      balance: String(a.balance ?? ''),
      include_in_net_worth: !!a.include_in_net_worth,
      notes: a.notes || '',
      monthly_contribution: String(a.monthly_contribution ?? ''),
      annual_interest_rate_percent: String(a.annual_interest_rate_percent ?? ''),
      _nameHint: '', // ✅ prevent any add-mode hint behaviour in edit
    })
    setModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      showToast?.('Name is required', 'error')
      return
    }

    const body = {
      name: form.name.trim(),
      type: form.type,
      currency: (form.currency || 'GBP').toUpperCase(),
      balance: toNumber(form.balance, 0),
      include_in_net_worth: !!form.include_in_net_worth,
      notes: form.notes?.trim() ? form.notes.trim() : null,
      monthly_contribution: toNumber(form.monthly_contribution, 0),
      annual_interest_rate_percent: toNumber(form.annual_interest_rate_percent, 0),
    }

    setSaving(true)
    try {
      if (editing) {
        await api(`/accounts/${editing}`, { method: 'PUT', body })
        showToast?.('Account updated')
        setModal(false)
        await load({ silent: true })
        bumpData?.()
        return
      }

      if (accountLimitReached) {
        setModal(false)
        goUpgrade()
        return
      }

      await api('/accounts', { method: 'POST', body })
      showToast?.('Account added')
      track?.('account_added', { source: 'accounts_create' })

      setModal(false)
      await load()
      bumpData?.()
    } catch (e) {
      if (e?.status === 403) {
        setModal(false)
        goUpgrade()
        return
      }
      showToast?.(e?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const del = async (a) => {
    setConfirmState({
      title: `Delete "${a.name}"?`,
      message: 'This account and its data will be permanently removed.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmLoading(true)
        setSaving(true)
        try {
          await api(`/accounts/${a.id}`, { method: 'DELETE' })
          showToast?.('Deleted')
          setConfirmState(null)
          await load()
          bumpData?.()
        } catch (e) {
          showToast?.(e?.message || 'Delete failed', 'error')
        } finally {
          setSaving(false)
          setConfirmLoading(false)
        }
      },
    })
  }

  const inp =
    'w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const lbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2'

  if (loading) {
    return (
      <div className="space-y-7 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="h-9 w-36 rounded-lg skeleton" />
            <div className="h-4 w-64 rounded skeleton mt-2" />
          </div>
          <div className="h-11 w-20 rounded-2xl skeleton" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-5 border border-black/[.04] dark:border-white/[.05] bg-white dark:bg-surface-dark-2"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl skeleton" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-28 rounded skeleton" />
                    <div className="h-3 w-16 rounded skeleton" />
                  </div>
                </div>
                <div className="h-7 w-24 rounded skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] sm:text-4xl text-ink dark:text-white tracking-tight">
            Accounts
          </h1>
          <p className="text-sm text-ink-muted dark:text-white/35 mt-1.5">
            Connect the inputs for your net worth tracker.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage('settings')}
            className="lg:hidden p-3 rounded-2xl border border-black/[.06] dark:border-white/[.06] text-ink-muted dark:text-white/35 hover:bg-surface-2 dark:hover:bg-white/5 transition-colors min-h-[44px]"
            title="Settings"
            aria-label="Settings"
            disabled={saving}
            type="button"
          >
            <Settings size={18} />
          </button>

          <button
            onClick={() => {
              if (accountLimitReached) return goUpgrade()
              openAdd()
            }}
            className={[
              'flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl transition-all active:scale-[.97] touch-press min-h-[44px]',
              accountLimitReached
                ? 'bg-gradient-to-r from-accent to-accent-dark text-white hover:opacity-90'
                : 'bg-accent text-white hover:bg-accent-dark',
            ].join(' ')}
            disabled={saving}
            title={accountLimitReached ? 'Upgrade to add more accounts' : 'Add an account'}
            type="button"
          >
            {accountLimitReached ? (
              <>
                <Crown size={16} /> Upgrade
              </>
            ) : (
              <>
                <Plus size={17} /> Add
              </>
            )}
          </button>
        </div>
      </div>

      {!isPro && usage && !accountLimitReached && (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink dark:text-white">
                {usage.used} of {usage.limit} accounts used
              </div>
              <div className="text-xs text-ink-muted dark:text-white/35 mt-1">
                Upgrade for unlimited accounts and longer projections.
              </div>

              <div className="mt-3 h-2 rounded-full bg-black/[.06] dark:bg-white/[.08] overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${usage.pct}%` }} />
              </div>
            </div>

            <UpgradeButton onClick={goUpgrade} size="sm" className="shrink-0" title="Upgrade to Pro">
              Upgrade
            </UpgradeButton>
          </div>
        </Card>
      )}

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="Add your first account"
            subtitle="Add one account to generate your first net worth view and long-term outlook."
            action={
              <button
                onClick={() => {
                  if (accountLimitReached) return goUpgrade()
                  openAdd()
                }}
                className="flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all min-h-[48px]"
                type="button"
              >
                {accountLimitReached ? 'Upgrade to add more accounts' : 'Add Account'}
              </button>
            }
          />
        </Card>
      ) : (
        <>
          {accountLimitReached && (
            <div className="rounded-2xl border border-accent/15 dark:border-accent/20 bg-gradient-to-br from-accent/[.04] via-transparent to-accent/[.02] dark:from-accent/[.08] dark:via-transparent dark:to-accent/[.03] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-accent/[.04] dark:bg-accent/[.06] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />

              <div className="relative flex items-start gap-5">
                <div className="hidden sm:flex shrink-0 w-11 h-11 rounded-2xl bg-accent/10 dark:bg-accent/15 items-center justify-center">
                  <Sparkles size={20} className="text-accent" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink dark:text-white">
                    You&apos;ve used all {FREE_ACCOUNT_LIMIT} free accounts
                  </div>
                  <p className="text-xs text-ink-muted dark:text-white/40 mt-1 leading-relaxed">
                    Upgrade to Pro for unlimited accounts, 40-year projections, inflation modelling, and the Optimiser.
                  </p>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 max-w-[200px] rounded-full bg-accent/15 dark:bg-accent/20 overflow-hidden">
                      <div className="h-full w-full rounded-full bg-accent" />
                    </div>
                    <span className="text-xs font-semibold text-accent tabular-nums">
                      {FREE_ACCOUNT_LIMIT}/{FREE_ACCOUNT_LIMIT}
                    </span>
                  </div>
                </div>

                <button
                  onClick={goUpgrade}
                  className="shrink-0 flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-accent text-white hover:bg-accent-dark transition-colors"
                  type="button"
                >
                  <Crown size={14} /> Upgrade
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accounts.map((a) => {
              const Icon = TYPE_ICON?.[a.type] || TYPE_ICON.other
              const label = ACCOUNT_TYPE_LABELS?.[a.type] || a.type

              return (
                <Card key={a.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-black/[.03] dark:bg-white/[.05] grid place-items-center shrink-0">
                          <Icon size={16} strokeWidth={1.75} className="text-ink/70 dark:text-white/45" />
                        </div>

                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-ink dark:text-white truncate leading-tight">
                            {a.name}
                          </div>
                          <div className="text-xs text-ink-muted dark:text-white/35 mt-0.5">
                            {label} · {String(a.currency || '').toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => openEdit(a)}
                        className="p-2.5 rounded-xl bg-black/[.03] dark:bg-white/[.05] hover:bg-black/[.06] dark:hover:bg-white/[.08] transition-colors"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => del(a)}
                        className="p-2.5 rounded-xl bg-black/[.03] dark:bg-white/[.05] hover:bg-black/[.06] dark:hover:bg-white/[.08] transition-colors"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-ink-muted dark:text-white/35">Balance</div>
                      <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink dark:text-white tabular-nums">
                        {fmtCurrency(a.balance || 0, a.currency || 'GBP')}
                      </div>
                    </div>

                    <span
                      className={[
                        'text-[11px] px-2.5 py-1 rounded-full border',
                        'bg-black/[.02] dark:bg-white/[.04]',
                        'border-black/[.06] dark:border-white/[.10]',
                        a.include_in_net_worth ? 'text-ink-muted dark:text-white/45' : 'text-ink-muted/60 dark:text-white/30',
                      ].join(' ')}
                    >
                      {a.include_in_net_worth ? 'Included' : 'Excluded'}
                    </span>
                  </div>

                  {(a.monthly_contribution || a.annual_interest_rate_percent) ? (
                    <div className="mt-4 pt-4 border-t border-black/[.06] dark:border-white/[.07] text-xs text-ink-muted dark:text-white/35 space-y-1">
                      {!!a.monthly_contribution && (
                        <div className="flex justify-between">
                          <span>Monthly contribution</span>
                          <span className="text-ink dark:text-white/70">
                            {fmtCurrency(a.monthly_contribution, a.currency || 'GBP')}
                          </span>
                        </div>
                      )}
                      {!!a.annual_interest_rate_percent && (
                        <div className="flex justify-between">
                          <span>Interest rate</span>
                          <span className="text-ink dark:text-white/70">
                            {Number(a.annual_interest_rate_percent).toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </Card>
              )
            })}
          </div>

          <Card className="p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink dark:text-white">Account mix</div>
                <div className="text-xs text-ink-muted dark:text-white/35 mt-1">
                  A compact overview of what you’re tracking.
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <div className="text-xs text-ink-muted dark:text-white/50">Total monthly contributions</div>
                  <div className="text-sm font-semibold text-ink dark:text-white">
                    {fmtCurrencyCompact(totalMonthlyContribution, baseCurrency)}
                    <span className="text-xs font-medium text-ink-muted dark:text-white/40">/mo</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {donutData.slice(0, 3).map((d) => (
                    <div key={d.type} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colorByType.get(d.type) || donutFills[0] }} />
                        <div className="text-sm text-ink dark:text-white/80 truncate">{d.label}</div>
                      </div>
                      <div className="text-xs text-ink-muted dark:text-white/35 tabular-nums">
                        {d.count} · {d.pct.toFixed(0)}%
                      </div>
                    </div>
                  ))}
                  {donutData.length > 3 ? (
                    <div className="text-xs text-ink-muted dark:text-white/35">+{donutData.length - 3} more</div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 w-[132px] h-[132px] min-w-[132px] min-h-[132px]">
                <DonutChart
                  enabled={chartsReady}
                  donutData={donutData}
                  donutFills={donutFills}
                  donutStroke={donutStroke}
                />

                <div className="pointer-events-none -mt-[132px] w-[132px] h-[132px] grid place-items-center">
                  <div className="text-center">
                    <div className="text-xs text-ink-muted dark:text-white/35">Total</div>
                    <div className="text-lg font-semibold text-ink dark:text-white tabular-nums">{accounts.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Snapshots */}
          <div className="pt-2 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink dark:text-white">Snapshots</div>
                <div className="text-xs text-ink-muted dark:text-white/35">Record net worth over time. Your total lives on Home.</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={recordSnapshot}
                  disabled={saving}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-2xl border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px]"
                  type="button"
                  title="Record snapshot"
                >
                  <Camera size={16} className="opacity-80" />
                  Record
                </button>

                <button
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-2xl border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors min-h-[44px]"
                  type="button"
                  title="Toggle history"
                >
                  <Clock size={16} className="opacity-80" />
                  History{' '}
                  <ChevronDown size={16} className={`opacity-70 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-ink-muted dark:text-white/35">Last recorded</div>
                  <div className="mt-1 text-sm font-semibold text-ink dark:text-white">
                    {sortedSnaps[0] ? fmtDate(sortedSnaps[0].created_at) : snaps.length ? '—' : 'Not yet'}
                  </div>
                </div>
                <div className="text-xs text-ink-muted dark:text-white/35 tabular-nums">
                  {sortedSnaps[0]?.excluded_accounts > 0 ? `${sortedSnaps[0].excluded_accounts} excluded` : ''}
                </div>
              </div>
            </Card>

            {historyOpen && (
              <Card className="p-5">
                {snapsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 rounded-xl skeleton" />
                    ))}
                  </div>
                ) : sortedSnaps.length === 0 ? (
                  <div className="text-sm text-ink-muted dark:text-white/35">
                    No snapshots yet. Record one to start building history.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedSnaps.map((s, idx) => {
                      const prev = sortedSnaps[idx + 1]
                      const v = snapBaseTotal(s)
                      const pv = prev ? snapBaseTotal(prev) : null
                      const d = v != null && pv != null ? v - pv : null
                      const pct = d != null && pv != null && pv !== 0 ? (d / Math.abs(pv)) * 100 : null

                      const isOpen = expandedSnap === s.id
                      const hasBreakdown = Array.isArray(s.breakdown) && s.breakdown.length > 0
                      const cur = (s.base_currency || snapCurrency || 'GBP').toUpperCase()

                      return (
                        <div key={s.id} className="rounded-2xl border border-black/[.06] dark:border-white/[.07] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedSnap((prevId) => (prevId === s.id ? null : s.id))}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-black/[.02] dark:hover:bg-white/[.04] transition-colors text-left"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-ink dark:text-white">{fmtDate(s.created_at)}</div>
                              <div className="text-xs text-ink-muted dark:text-white/35">
                                {idx === sortedSnaps.length - 1 ? 'First snapshot' : 'Compared to previous'}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {d != null && pct != null ? (
                                <ChangePill change={d} changePct={pct} currency={cur} size="sm" />
                              ) : (
                                <span className="text-xs text-ink-muted dark:text-white/25 font-medium">—</span>
                              )}
                              <ChevronDown size={16} className={`opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4 pt-2 bg-black/[.01] dark:bg-white/[.03] border-t border-black/[.06] dark:border-white/[.07]">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-ink-muted dark:text-white/35">{hasBreakdown ? 'Breakdown' : 'Snapshot'}</div>
                                <button
                                  type="button"
                                  onClick={() => deleteSnap(s.id)}
                                  className="text-xs font-semibold text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white transition-colors"
                                >
                                  Delete
                                </button>
                              </div>

                              {hasBreakdown ? (
                                <div className="mt-3 space-y-2.5">
                                  {s.breakdown.map((b) => (
                                    <div key={b.id || `${b.name}-${b.currency}`} className="flex justify-between items-center text-sm">
                                      <span className="text-ink-muted dark:text-white/45">
                                        {b.name}{' '}
                                        <span className="text-ink-muted/40 dark:text-white/20">({b.currency})</span>
                                      </span>
                                      <span className="text-ink dark:text-white font-medium tabular-nums">
                                        {fmtCurrency(Number.isFinite(Number(b.value_base)) ? Number(b.value_base) : 0, cur)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )}
          </div>
        </>
      )}

      <Modal open={modal} onClose={() => (!saving ? setModal(false) : null)} title={editing ? 'Edit account' : 'Add account'}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className="space-y-4"
        >
          <div>
            <label className={lbl}>Name</label>
            <input
  className={inp}
  value={form.name}
  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
  placeholder={accountNamePlaceholder(form?.type)}
/>

<p className="text-[11px] text-ink-muted/50 dark:text-white/25 mt-1">
  Use a name you'll recognise later.
</p>
          </div>
          

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Type</label>
              <select className={inp} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS?.[t] || t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={lbl}>Currency</label>
              <select className={inp} value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Balance</label>
            <input className={inp} value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))} inputMode="decimal"
            placeholder="e.g. 12,500" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-ink dark:text-white">Include in net worth</label>
            <input
              type="checkbox"
              checked={!!form.include_in_net_worth}
              onChange={(e) => setForm((f) => ({ ...f, include_in_net_worth: e.target.checked }))}
              className="h-5 w-5 rounded border-black/[.20] dark:border-white/[.20]"
            />
          </div>

          <div>
            <label className={lbl}>Notes (optional)</label>
            <textarea className={inp} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
            placeholder="Optional notes about this account, e.g Emergency fund" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Monthly contribution (optional, per month))</label>
              <input className={inp} value={form.monthly_contribution} onChange={(e) => setForm((f) => ({ ...f, monthly_contribution: e.target.value }))} inputMode="decimal"
              placeholder="e.g. 500" />
            </div>
            <div>
              <label className={lbl}>Expected annual return % (optional)</label>
              <input className={inp} value={form.annual_interest_rate_percent} onChange={(e) => setForm((f) => ({ ...f, annual_interest_rate_percent: e.target.value }))} inputMode="decimal"
              placeholder="e.g. 5.2" />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-4 py-3 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
              onClick={() => setModal(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-3 rounded-2xl text-sm font-semibold bg-accent text-white hover:bg-accent-dark transition-colors disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Saving…' : editing ? 'Update account' : 'Add account'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel || 'Delete'}
        destructive
        loading={confirmLoading}
        onConfirm={confirmState?.onConfirm}
        onCancel={() => {
          setConfirmState(null)
          setConfirmLoading(false)
        }}
      />
    </div>
  )
}