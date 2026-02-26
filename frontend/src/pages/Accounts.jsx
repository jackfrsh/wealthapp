// frontend/src/pages/Accounts.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import { track } from '../track'
import UpgradeButton from '../components/UpgradeButton'
import {
  fmtCurrency,
  fmtDate,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ICONS,
  CURRENCIES,
} from '../utils'
import { Plus, Pencil, Trash2, Settings, Camera, ChevronDown, Clock } from 'lucide-react'

const TYPES = ['bank', 'isa', 'sipp', 'crypto', 'investment', 'property', 'mortgage', 'loan', 'other']

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

function toNumber(input, fallback = 0) {
  const s = String(input ?? '').trim()
  if (!s) return fallback
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

// Snapshot value helper (server payloads vary)
function snapTotal(s) {
  const v =
    s?.total ??
    s?.net_worth ??
    s?.value ??
    s?.amount ??
    s?.total_value ??
    s?.total_amount
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default function Accounts() {
  const { baseCurrency, showToast, setPage, bumpData, isPro } = useApp()

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null) // id or null
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  // Snapshot state
  const [snaps, setSnaps] = useState([])
  const [snapsLoading, setSnapsLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expandedSnap, setExpandedSnap] = useState(null)

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
    try {
      const res = await api('/accounts')
      setAccounts(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error(e)
      showToast?.(e?.message || 'Failed to load accounts', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const loadSnaps = useCallback(async () => {
    try {
      const res = await api('/snapshots', { method: 'GET' })
      setSnaps(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error(e)
    } finally {
      setSnapsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSnaps()
  }, [loadSnaps])

  const recordSnapshot = async () => {
    try {
      await api('/snapshots', { method: 'POST' })
      showToast?.('Net worth recorded!')
      await loadSnaps()
      bumpData?.()
    } catch (e) {
      showToast?.(e?.message || 'Failed to record', 'error')
    }
  }

  const deleteSnap = async (id) => {
    if (!confirm('Delete this record?')) return
    try {
      await api(`/snapshots/${id}`, { method: 'DELETE' })
      showToast?.('Deleted')
      setExpandedSnap((prev) => (prev === id ? null : prev))
      await loadSnaps()
      bumpData?.()
    } catch (e) {
      showToast?.(e?.message || 'Delete failed', 'error')
    }
  }

  const sortedSnaps = useMemo(() => {
    return [...snaps].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [snaps])

  const latestSnap = sortedSnaps[0] || null
  const prevSnap = sortedSnaps[1] || null
  const latestVal = latestSnap ? snapTotal(latestSnap) : null
  const prevVal = prevSnap ? snapTotal(prevSnap) : null
  const snapDelta =
    latestVal != null && prevVal != null ? latestVal - prevVal : null
  const snapDeltaPct =
    latestVal != null && prevVal != null && prevVal !== 0
      ? (snapDelta / Math.abs(prevVal)) * 100
      : null

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, currency: baseCurrency })
    setModal(true)
  }

  const openEdit = (a) => {
    setEditing(a.id)
    setForm({
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: String(a.balance ?? ''),
      include_in_net_worth: !!a.include_in_net_worth,
      notes: a.notes || '',
      monthly_contribution: String(a.monthly_contribution ?? ''),
      annual_interest_rate_percent: String(a.annual_interest_rate_percent ?? ''),
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
        await load()
        bumpData?.()
        return
      }

      // Creating new account
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
    if (!confirm(`Delete "${a.name}"?`)) return

    setSaving(true)
    try {
      await api(`/accounts/${a.id}`, { method: 'DELETE' })
      showToast?.('Deleted')
      await load()
      bumpData?.()
    } catch (e) {
      showToast?.(e?.message || 'Delete failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inp =
    'w-full px-4 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-base text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const lbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2'

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-12 w-48 rounded-lg skeleton" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[180px] rounded-2xl skeleton" />
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

          {/* IMPORTANT: when limit reached, don’t show an extra Upgrade CTA here.
              The limit banner below owns the CTA. */}
          <button
            onClick={() => {
              if (accountLimitReached) return
              openAdd()
            }}
            className={[
              'flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl transition-all active:scale-[.97] touch-press min-h-[44px]',
              accountLimitReached
                ? 'bg-black/[.04] dark:bg-white/[.06] text-ink-muted/60 dark:text-white/25 cursor-not-allowed'
                : 'bg-accent text-white hover:bg-accent-dark',
            ].join(' ')}
            disabled={saving || accountLimitReached}
            title={accountLimitReached ? 'Upgrade to add more accounts' : 'Add an account'}
            type="button"
          >
            <Plus size={17} /> Add
          </button>
        </div>
      </div>

      {/* Usage meter (Free only, but hide when hard-blocked to avoid duplicate CTAs) */}
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
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${usage.pct}%` }}
                />
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
            icon="🏦"
            title="Add your first account"
            subtitle="Add one account to generate your first net worth view and long-term outlook."
            action={
              <button
                onClick={() => {
                  if (accountLimitReached) {
                    goUpgrade()
                    return
                  }
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
          {/* Hard limit banner (only when blocked) */}
          {accountLimitReached && (
            <Card className="p-5 border-amber-500/30 bg-amber-50 dark:bg-amber-500/5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-ink dark:text-white">
                    Free plan limit reached
                  </div>
                  <div className="text-xs text-ink-muted dark:text-white/35 mt-1">
                    Free users can track up to {FREE_ACCOUNT_LIMIT} accounts. Pro unlocks unlimited
                    accounts and longer projections.
                  </div>
                </div>

                <UpgradeButton onClick={goUpgrade} size="sm">
                  Upgrade
                </UpgradeButton>
              </div>
            </Card>
          )}

          {/* Accounts grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accounts.map((a) => {
              const Icon = ACCOUNT_TYPE_ICONS?.[a.type] || ACCOUNT_TYPE_ICONS?.other
              const label = ACCOUNT_TYPE_LABELS?.[a.type] || a.type

              return (
                <Card key={a.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {Icon ? <Icon size={16} className="opacity-70" /> : null}
                        <div className="text-sm font-semibold text-ink dark:text-white truncate">
                          {a.name}
                        </div>
                      </div>
                      <div className="text-xs text-ink-muted dark:text-white/35 mt-1">
                        {label} · {String(a.currency || '').toUpperCase()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => openEdit(a)}
                        className="p-2 rounded-xl border border-black/[.06] dark:border-white/[.06] hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => del(a)}
                        className="p-2 rounded-xl border border-black/[.06] dark:border-white/[.06] hover:bg-surface-2 dark:hover:bg-white/5 transition-colors"
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
                      <div className="mt-1 text-xl font-semibold tracking-tight text-ink dark:text-white [font-variant-numeric:tabular-nums]">
                        {fmtCurrency(a.balance || 0, a.currency || 'GBP')}
                      </div>
                    </div>

                    {a.include_in_net_worth ? (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-black/[.03] dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.10] text-ink-muted dark:text-white/40">
                        Included
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-black/[.02] dark:bg-white/[.04] border border-black/[.06] dark:border-white/[.10] text-ink-muted/70 dark:text-white/30">
                        Excluded
                      </span>
                    )}
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

          {/* Snapshots — premium: hero + useful delta + optional history */}
          <div className="pt-2 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink dark:text-white">Snapshots</div>
                <div className="text-xs text-ink-muted dark:text-white/35">
                  Record your net worth over time.
                </div>
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
                  <ChevronDown
                    size={16}
                    className={`opacity-70 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            </div>

            <Card className="p-6">
              {snapsLoading ? (
                <div className="h-20 rounded-2xl skeleton" />
              ) : !latestSnap ? (
                <div className="text-sm text-ink-muted dark:text-white/35">
                  No snapshots yet. Record your first net worth snapshot to start building history.
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold tracking-[.14em] uppercase text-ink-muted/60 dark:text-white/30">
                      Latest snapshot
                    </div>

                    <div className="mt-2 text-sm font-semibold text-ink dark:text-white">
                      {fmtDate(latestSnap.created_at)}
                    </div>

                    {latestVal != null ? (
                      <div className="mt-2 font-display text-3xl sm:text-4xl tracking-[-0.03em] text-ink dark:text-white [font-variant-numeric:tabular-nums]">
                        {fmtCurrency(latestVal, baseCurrency || 'GBP')}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-ink-muted dark:text-white/35">
                        Snapshot recorded.
                      </div>
                    )}

                    {snapDelta != null && snapDeltaPct != null ? (
                      <div className="mt-3 text-xs text-ink-muted/60 dark:text-white/30 tabular-nums">
                        Change vs previous:{' '}
                        <span className="font-semibold text-ink dark:text-white">
                          {snapDelta >= 0 ? '+' : ''}
                          {fmtCurrency(snapDelta, baseCurrency || 'GBP')}
                        </span>{' '}
                        <span className="text-ink-muted/50 dark:text-white/25">
                          ({snapDeltaPct >= 0 ? '+' : ''}
                          {snapDeltaPct.toFixed(1)}%)
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-ink-muted/60 dark:text-white/30">
                        Record one more snapshot to see change.
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => deleteSnap(latestSnap.id)}
                      className="px-3.5 py-2 rounded-2xl text-xs font-semibold border border-black/[.08] dark:border-white/[.10] text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
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
                    No snapshots yet. Record your first net worth snapshot to start building history.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedSnaps.map((s, idx) => {
                      const isOpen = expandedSnap === s.id
                      const val = snapTotal(s)
                      const next = sortedSnaps[idx + 1]
                      const nextVal = next ? snapTotal(next) : null
                      const d = val != null && nextVal != null ? val - nextVal : null

                      return (
                        <div
                          key={s.id}
                          className="rounded-2xl border border-black/[.06] dark:border-white/[.07] overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedSnap((prev) => (prev === s.id ? null : s.id))}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-black/[.02] dark:hover:bg-white/[.04] transition-colors text-left"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-ink dark:text-white">
                                {fmtDate(s.created_at)}
                              </div>
                              <div className="text-xs text-ink-muted dark:text-white/35 tabular-nums">
                                {val != null ? (
                                  <>
                                    {fmtCurrency(val, baseCurrency || 'GBP')}
                                    {d != null ? (
                                      <span className="ml-2 text-ink-muted/50 dark:text-white/25">
                                        · {d >= 0 ? '+' : ''}
                                        {fmtCurrency(d, baseCurrency || 'GBP')}
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  'Snapshot'
                                )}
                              </div>
                            </div>
                            <ChevronDown
                              size={16}
                              className={`opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            />
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4 pt-2 bg-black/[.01] dark:bg-white/[.03] border-t border-black/[.06] dark:border-white/[.07]">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-ink-muted dark:text-white/35">
                                  Recorded net worth snapshot
                                </div>
                                <button
                                  type="button"
                                  onClick={() => deleteSnap(s.id)}
                                  className="text-xs font-semibold text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
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

      {/* Modal */}
      <Modal
        open={modal}
        onClose={() => (!saving ? setModal(false) : null)}
        title={editing ? 'Edit account' : 'Add account'}
      >
        <div className="space-y-4">
          <div>
            <label className={lbl}>Name</label>
            <input
              className={inp}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Barclays Current Account"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Type</label>
              <select
                className={inp}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS?.[t] || t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={lbl}>Currency</label>
              <select
                className={inp}
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              >
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
            <input
              className={inp}
              value={form.balance}
              onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
              placeholder="e.g., 12500"
              inputMode="decimal"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-ink dark:text-white">
              Include in net worth
            </label>
            <input
              type="checkbox"
              checked={!!form.include_in_net_worth}
              onChange={(e) => setForm((f) => ({ ...f, include_in_net_worth: e.target.checked }))}
              className="h-5 w-5 rounded border-black/[.20] dark:border-white/[.20]"
            />
          </div>

          <div>
            <label className={lbl}>Notes (optional)</label>
            <textarea
              className={inp}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Anything you want to remember about this account…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Monthly contribution (optional)</label>
              <input
                className={inp}
                value={form.monthly_contribution}
                onChange={(e) => setForm((f) => ({ ...f, monthly_contribution: e.target.value }))}
                placeholder="e.g., 250"
                inputMode="decimal"
              />
            </div>

            <div>
              <label className={lbl}>Interest rate % (optional)</label>
              <input
                className={inp}
                value={form.annual_interest_rate_percent}
                onChange={(e) =>
                  setForm((f) => ({ ...f, annual_interest_rate_percent: e.target.value }))
                }
                placeholder="e.g., 4.5"
                inputMode="decimal"
              />
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
              type="button"
              className="px-5 py-3 rounded-2xl text-sm font-semibold bg-accent text-white hover:bg-accent-dark transition-colors disabled:opacity-60"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}