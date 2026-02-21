import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { useApp } from '../App'
import Card from '../components/Card'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'
import ChangePill from '../components/ChangePill'
import UpgradeButton from '../components/UpgradeButton'
import { fmtCurrency, fmtDate, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ICONS, CURRENCIES } from '../utils'
import { Plus, Pencil, Trash2, Settings, Camera, ChevronDown, ChevronUp, Clock, LogOut } from 'lucide-react'

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

export default function Accounts() {
  const { baseCurrency, showToast, setPage, bumpData, dataVersion, isPro, handleLogout } = useApp()

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
  const accountLimitReached = !isPro && accounts.length >= FREE_ACCOUNT_LIMIT

  const load = useCallback(async () => {
    try {
      const res = await api('/accounts')
      setAccounts(Array.isArray(res) ? res : [])
    } catch (e) {
      console.error(e)
      showToast(e?.message || 'Failed to load accounts', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    load()
  }, [load, dataVersion])

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
  }, [loadSnaps, dataVersion])

  const recordSnapshot = async () => {
    try {
      await api('/snapshots', { method: 'POST' })
      showToast('Net worth recorded!')
      loadSnaps()
      bumpData()
    } catch (e) {
      showToast(e?.message || 'Failed to record', 'error')
    }
  }

  const deleteSnap = async (id) => {
    if (!confirm('Delete this record?')) return
    try {
      await api(`/snapshots/${id}`, { method: 'DELETE' })
      showToast('Deleted')
      loadSnaps()
      bumpData()
    } catch (e) {
      showToast(e?.message || 'Delete failed', 'error')
    }
  }

  const sortedSnaps = [...snaps].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

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
      showToast('Name is required', 'error')
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
        // If Swagger uses PATCH instead of PUT, change method to 'PATCH'
        await api(`/accounts/${editing}`, { method: 'PUT', body })
        showToast('Account updated')
      } else {
        if (accountLimitReached) {
          setModal(false)
          localStorage.setItem('upgrade_reason', 'account_limit')
          setPage('upgrade')
          return
        }
        await api('/accounts', { method: 'POST', body })
        showToast('Account added')
      }

      setModal(false)
      await load()
      bumpData()
    } catch (e) {
      if (e?.status === 403) {
        setModal(false)
        localStorage.setItem('upgrade_reason', 'account_limit')
        setPage('upgrade')
        return
      }
      showToast(e?.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const del = async (a) => {
    if (!confirm(`Delete "${a.name}"?`)) return

    setSaving(true)
    try {
      await api(`/accounts/${a.id}`, { method: 'DELETE' })
      showToast('Deleted')
      await load()
      bumpData()
    } catch (e) {
      showToast(e?.message || 'Delete failed', 'error')
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] sm:text-4xl text-ink dark:text-white tracking-tight">
            Accounts
          </h1>
          <p className="text-sm text-ink-muted dark:text-white/35 mt-1.5">Your Holdings</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage('settings')}
            className="lg:hidden p-3 rounded-2xl border border-black/[.06] dark:border-white/[.06] text-ink-muted dark:text-white/35 hover:bg-surface-2 dark:hover:bg-white/5 transition-colors min-h-[44px]"
            title="Settings"
            disabled={saving}
            type="button"
          >
            <Settings size={18} />
          </button>

          <button
            onClick={() => {
              if (accountLimitReached) {
                localStorage.setItem('upgrade_reason', 'account_limit')
                setPage('upgrade')
                return
              }
              openAdd()
            }}
            className="flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all active:scale-[.97] touch-press min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={saving}
            title={accountLimitReached ? 'Upgrade to add more accounts' : 'Add an account'}
            type="button"
          >
            <Plus size={17} /> {accountLimitReached ? 'Upgrade' : 'Add'}
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon="🏦"
            title="No accounts yet"
            subtitle="Add your first financial account to start building your wealth plan."
            action={
              <button
                onClick={() => {
                  if (accountLimitReached) {
                    localStorage.setItem('upgrade_reason', 'account_limit')
                    setPage('upgrade')
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
          {accountLimitReached && (
            <Card className="p-5 border-amber-500/30 bg-amber-50 dark:bg-amber-500/5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-ink dark:text-white">Free plan limit reached</div>
                  <div className="text-xs text-ink-muted dark:text-white/35 mt-1">
                    Free users can track up to {FREE_ACCOUNT_LIMIT} accounts.
                  </div>
                </div>

                <UpgradeButton
                  onClick={() => {
                    localStorage.setItem('upgrade_reason', 'account_limit')
                    setPage('upgrade')
                  }}
                  size="sm"
                >
                  Upgrade
                </UpgradeButton>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accounts.map((a) => (
              <Card key={a.id} hover className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{ACCOUNT_TYPE_ICONS[a.type] || '📦'}</span>
                    <div>
                      <div className="font-semibold text-base text-ink dark:text-white">{a.name}</div>
                      <div className="text-xs text-ink-muted dark:text-white/35 mt-0.5">{a.currency}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold tracking-[.04em] uppercase px-2.5 py-1 rounded-full bg-surface-2 dark:bg-white/5 text-ink-muted dark:text-white/35">
                    {ACCOUNT_TYPE_LABELS[a.type] || a.type}
                  </span>
                </div>

                <div className="font-display text-[2rem] tracking-[-0.02em] text-ink dark:text-white mb-1.5 tabular-nums">
                  {fmtCurrency(a.balance, a.currency)}
                </div>

                {!a.include_in_net_worth && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2">
                    Excluded from net worth
                  </div>
                )}

                {(a.monthly_contribution > 0 || a.annual_interest_rate_percent > 0) && (
                  <div className="text-xs text-ink-muted/70 dark:text-white/25 mb-2">
                    {a.monthly_contribution > 0 && `${fmtCurrency(a.monthly_contribution, a.currency)}/mo`}
                    {a.monthly_contribution > 0 && a.annual_interest_rate_percent > 0 && ' · '}
                    {a.annual_interest_rate_percent > 0 && `${a.annual_interest_rate_percent}% p.a.`}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-black/[.06] dark:border-white/[.04]">
                  <button
                    onClick={() => openEdit(a)}
                    className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink dark:text-white/40 dark:hover:text-white px-3 py-2 rounded-xl hover:bg-black/[.03] dark:hover:bg-white/5 transition-colors min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={saving}
                    type="button"
                  >
                    <Pencil size={14} className="opacity-80" /> Edit
                  </button>

                  <button
                    onClick={() => del(a)}
                    className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-[#b42318] dark:text-red-400/80 dark:hover:text-red-300 px-3 py-2 rounded-xl hover:bg-black/[.03] dark:hover:bg-red-500/10 transition-colors min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={saving}
                    type="button"
                  >
                    <Trash2 size={14} className="opacity-75" /> Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Net Worth History */}
      <Card className="overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setHistoryOpen(!historyOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setHistoryOpen(!historyOpen)
          }}
          className="w-full flex items-center justify-between gap-3 px-6 py-5 hover:bg-black/[.02] dark:hover:bg-white/[.02] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-2xl flex items-center justify-center bg-accent/10 dark:bg-accent/10">
              <Clock size={17} className="text-accent" />
            </span>
            <div className="text-left">
              <div className="text-sm font-semibold text-ink dark:text-white">Net Worth History</div>
              <div className="text-xs text-ink-muted/60 dark:text-white/25 mt-0.5">
                {sortedSnaps.length === 0
                  ? 'Record snapshots to track progress'
                  : `${sortedSnaps.length} snapshot${sortedSnaps.length !== 1 ? 's' : ''} recorded`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                recordSnapshot()
              }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-accent/10 text-accent hover:bg-accent/15 transition-colors min-h-[36px]"
              type="button"
            >
              <Camera size={14} /> Record
            </button>

            {historyOpen ? (
              <ChevronUp size={18} className="text-ink-muted/40 dark:text-white/25" />
            ) : (
              <ChevronDown size={18} className="text-ink-muted/40 dark:text-white/25" />
            )}
          </div>
        </div>

        {historyOpen && (
          <div className="border-t border-black/[.04] dark:border-white/[.04]">
            {snapsLoading ? (
              <div className="px-6 py-8 text-center">
                <div className="text-xs text-ink-muted/50 dark:text-white/25">Loading...</div>
              </div>
            ) : sortedSnaps.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <div className="text-sm text-ink-muted dark:text-white/35 mb-3">No snapshots yet</div>
                <button
                  onClick={recordSnapshot}
                  className="text-sm font-semibold px-5 py-2.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-colors"
                  type="button"
                >
                  Record your first snapshot
                </button>
              </div>
            ) : (
              <div className="divide-y divide-black/[.04] dark:divide-white/[.04] max-h-[400px] overflow-y-auto">
                {sortedSnaps.map((snap, i) => {
                  const prev = sortedSnaps[i + 1]
                  const delta = prev ? snap.total_base - prev.total_base : null
                  const deltaPct =
                    prev && prev.total_base !== 0
                      ? ((snap.total_base - prev.total_base) / Math.abs(prev.total_base)) * 100
                      : null
                  const isExpanded = expandedSnap === snap.id
                  const breakdown = snap.breakdown || []

                  return (
                    <div key={snap.id} className="px-6 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-display text-lg text-ink dark:text-white tracking-tight tabular-nums">
                            {fmtCurrency(snap.total_base, snap.base_currency)}
                          </div>
                          <div className="text-xs text-ink-muted dark:text-white/35 mt-0.5">
                            {fmtDate(snap.created_at)}
                            {snap.excluded_accounts > 0 && ` · ${snap.excluded_accounts} excluded`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {delta !== null ? (
                            <ChangePill
                              change={delta}
                              changePct={deltaPct || 0}
                              currency={snap.base_currency}
                              size="sm"
                            />
                          ) : (
                            <span className="text-xs text-ink-muted dark:text-white/25 font-medium">First</span>
                          )}

                          {breakdown.length > 0 && (
                            <button
                              onClick={() => setExpandedSnap(isExpanded ? null : snap.id)}
                              className="p-1.5 rounded-lg hover:bg-surface-2 dark:hover:bg-white/5 text-ink-muted dark:text-white/35 transition-colors"
                              type="button"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}

                          <button
                            onClick={() => deleteSnap(snap.id)}
                            className="p-1.5 rounded-lg hover:bg-loss-light dark:hover:bg-loss/10 text-ink-muted/30 hover:text-loss transition-colors"
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {isExpanded && breakdown.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-black/[.03] dark:border-white/[.03] space-y-2 animate-fade-in">
                          {breakdown.map((b) => (
                            <div key={b.id} className="flex justify-between items-center text-sm">
                              <span className="text-ink-muted dark:text-white/45">
                                {b.name}{' '}
                                <span className="text-ink-muted/40 dark:text-white/20">({b.currency})</span>
                              </span>
                              <span className="text-ink dark:text-white font-medium tabular-nums">
                                {fmtCurrency(b.value_base, snap.base_currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => !saving && setModal(false)} title={editing ? 'Edit account' : 'Add account'}>
        <div className="space-y-5">
          <div>
            <label className={lbl}>Account name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inp}
              placeholder="ISA, Savings..."
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className={inp}
                disabled={saving}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t] || t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={lbl}>Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className={inp}
                disabled={saving}
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
              value={form.balance}
              onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
              className={inp}
              placeholder="25000"
              inputMode="decimal"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Monthly contribution</label>
              <input
                value={form.monthly_contribution}
                onChange={(e) => setForm((f) => ({ ...f, monthly_contribution: e.target.value }))}
                className={inp}
                placeholder="500"
                inputMode="decimal"
                disabled={saving}
              />
              <div className="text-xs text-ink-muted/70 dark:text-white/25 mt-1.5">For projections</div>
            </div>

            <div>
              <label className={lbl}>Annual return %</label>
              <input
                value={form.annual_interest_rate_percent}
                onChange={(e) => setForm((f) => ({ ...f, annual_interest_rate_percent: e.target.value }))}
                className={inp}
                placeholder="7"
                inputMode="decimal"
                disabled={saving}
              />
              <div className="text-xs text-ink-muted/70 dark:text-white/25 mt-1.5">Expected yearly return</div>
            </div>
          </div>

          <div className="flex items-center gap-3 min-h-[44px]">
            <input
              type="checkbox"
              checked={form.include_in_net_worth}
              onChange={(e) => setForm((f) => ({ ...f, include_in_net_worth: e.target.checked }))}
              className="w-5 h-5 accent-accent rounded"
              disabled={saving}
            />
            <label className="text-sm text-ink-3 dark:text-white/50 cursor-pointer">Include in net worth</label>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              onClick={save}
              className="flex-1 py-3 rounded-2xl bg-accent text-white font-semibold text-sm hover:bg-accent-dark transition-all min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={saving}
              type="button"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add account'}
            </button>

            <button
              onClick={() => setModal(false)}
              className="px-5 py-3 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-sm font-medium text-ink-muted dark:text-white/40 hover:bg-surface-2 dark:hover:bg-white/5 transition-colors min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={saving}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <div className="lg:hidden mt-10 pb-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium text-loss/70 hover:text-loss border border-loss/15 hover:bg-loss-light dark:hover:bg-loss/10 transition-colors"
          type="button"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  )
}