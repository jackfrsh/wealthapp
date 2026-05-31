import React, { useState, useEffect } from 'react'
import Modal from './Modal'
import { api, invalidatePath } from '../api'
import { accountFreshnessLabel, displayAccountLabel, fmtCurrency, CURRENCY_SYMBOLS } from '../utils'
import { CheckCircle } from 'lucide-react'

export default function QuickUpdateModal({ open, onClose, accounts, baseCurrency, onSaved }) {
  const [pendingAccounts, setPendingAccounts] = useState([])
  const [inputs, setInputs] = useState({})
  const [loadingId, setLoadingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)

  // Re-init when modal opens. Intentionally omits `accounts` from deps so edits
  // aren't reset if the parent re-fetches while the modal is open.
  useEffect(() => {
    if (!open) return
    const stale = (accounts ?? []).filter(
      (a) => accountFreshnessLabel(a.updated_at)?.state === 'stale'
    )
    setPendingAccounts(stale)
    setInputs(Object.fromEntries(stale.map((a) => [a.id, String(a.balance ?? '')])))
    setLoadingId(null)
    setErrors({})
    setDone(stale.length === 0)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const removeAccount = (id) => {
    setPendingAccounts((prev) => {
      const next = prev.filter((a) => a.id !== id)
      if (next.length === 0) setDone(true)
      return next
    })
  }

  const handleReview = async (account) => {
    if (loadingId != null) return
    setLoadingId({ id: account.id, action: 'review' })
    setErrors((prev) => ({ ...prev, [account.id]: null }))
    try {
      await api(`/accounts/${account.id}/review`, { method: 'POST' })
      invalidatePath('/accounts')
      invalidatePath('/dashboard')
      invalidatePath('/dashboard?range=3M')
      onSaved?.()
      removeAccount(account.id)
    } catch (e) {
      setErrors((prev) => ({ ...prev, [account.id]: e?.message || 'Could not mark reviewed. Try again.' }))
    } finally {
      setLoadingId(null)
    }
  }

  const handleUpdate = async (account) => {
    if (loadingId != null) return
    const rawInput = String(inputs[account.id] ?? '').replace(/,/g, '').trim()
    const newBalance = Number(rawInput)
    if (rawInput === '' || !Number.isFinite(newBalance)) {
      setErrors((prev) => ({ ...prev, [account.id]: 'Please enter a valid balance.' }))
      return
    }
    setLoadingId({ id: account.id, action: 'update' })
    setErrors((prev) => ({ ...prev, [account.id]: null }))
    try {
      await api(`/accounts/${account.id}`, { method: 'PATCH', body: { balance: newBalance } })
      invalidatePath('/accounts')
      invalidatePath('/dashboard')
      invalidatePath('/dashboard?range=3M')
      onSaved?.()
      removeAccount(account.id)
    } catch (e) {
      setErrors((prev) => ({ ...prev, [account.id]: e?.message || 'Could not update balance. Try again.' }))
    } finally {
      setLoadingId(null)
    }
  }

  const ccy = baseCurrency || 'GBP'
  const symbol = CURRENCY_SYMBOLS?.[ccy] ?? '£'

  return (
    <Modal open={open} onClose={onClose} title="Quick update">
      {done ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle size={40} className="text-emerald-400 opacity-80" />
          <div>
            <p className="text-[15px] font-semibold" style={{ color: 'rgba(230,235,245,0.90)' }}>
              Your wealth picture is up to date.
            </p>
            <p className="text-[13px] mt-1" style={{ color: 'rgba(160,170,190,0.55)' }}>
              All stale accounts have been reviewed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 px-5 py-2 rounded-xl text-[13px] font-semibold bg-white/[.07] border border-white/[.12] text-white/70 hover:text-white hover:bg-white/[.12] transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-[12px]" style={{ color: 'rgba(160,170,190,0.55)' }}>
            {pendingAccounts.length === 1
              ? "1 account hasn’t been updated in over 30 days."
              : `${pendingAccounts.length} accounts haven’t been updated in over 30 days.`}
            {' '}Update the balance or confirm it's still correct.
          </p>

          {pendingAccounts.map((account) => {
            const isBusy = loadingId?.id === account.id
            const isUpdating = isBusy && loadingId?.action === 'update'
            const isReviewing = isBusy && loadingId?.action === 'review'
            const error = errors[account.id]
            const label = displayAccountLabel(account)

            return (
              <div
                key={account.id}
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: 'rgba(230,235,245,0.88)' }}>
                      {account.name}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'rgba(160,170,190,0.45)' }}>
                      {label}
                    </p>
                  </div>
                  <p
                    className="text-[12px] font-semibold tabular-nums shrink-0 mt-0.5"
                    style={{ color: 'rgba(160,170,190,0.50)' }}
                  >
                    {fmtCurrency(account.balance, account.currency || ccy)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="text-[12px] font-semibold shrink-0"
                    style={{ color: 'rgba(160,170,190,0.45)' }}
                  >
                    {symbol}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={inputs[account.id] ?? ''}
                    onChange={(e) =>
                      setInputs((prev) => ({ ...prev, [account.id]: e.target.value }))
                    }
                    disabled={isBusy}
                    placeholder="New balance"
                    className="flex-1 min-w-0 bg-white/[.05] border border-white/[.10] rounded-xl px-3 py-2 text-[13px] font-semibold text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/25 disabled:opacity-40 tabular-nums"
                    style={{ appearance: 'textfield' }}
                  />
                </div>

                {error && (
                  <p className="text-[11px]" style={{ color: 'rgba(220,80,60,0.80)' }}>
                    {error}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate(account)}
                    disabled={isBusy}
                    className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-colors disabled:opacity-40 text-white bg-white/[.10] border border-white/[.14] hover:bg-white/[.16] active:scale-[.97]"
                  >
                    {isUpdating ? 'Saving…' : 'Save update'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(account)}
                    disabled={isBusy}
                    className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-colors disabled:opacity-40 hover:bg-white/[.05] active:scale-[.97]"
                    style={{ color: 'rgba(160,170,190,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {isReviewing ? 'Marking…' : 'No change'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
