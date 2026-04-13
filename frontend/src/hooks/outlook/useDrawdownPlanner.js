/**
 * useDrawdownPlanner
 *
 * Manages state and API interaction for the Retirement Drawdown Planner.
 *
 * Inputs pre-populate from the user's primary goal (ages, return %).
 * The pension pot must always be entered manually — it cannot be derived
 * from the total net worth goal without knowing which accounts are pension.
 *
 * Auto-calculates with a 600 ms debounce whenever inputs change.
 * Aborts previous in-flight requests on rapid re-entry.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api'

// ─── Defaults ────────────────────────────────────────────────────────────────

const BASE_DEFAULTS = {
  current_pot: '',
  current_age: '',
  retirement_age: '',
  monthly_contribution: '',
  annual_return_pct: '7',
  annual_fee_pct: '0.75',
  inflation_rate_pct: '2.5',
  lump_sum_type: 'none',   // "none" | "amount" | "percentage"
  lump_sum_value: '',
  withdrawal_mode: 'percentage',  // "percentage" | "fixed_monthly"
  withdrawal_value: '4',
  target_end_age: '95',
}

function numOrNull(v, fallback = null) {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function inputsAreValid(inp) {
  const currentAge = numOrNull(inp.current_age)
  const retAge = numOrNull(inp.retirement_age)
  const pot = numOrNull(inp.current_pot)
  const targetEnd = numOrNull(inp.target_end_age)
  const returnPct = numOrNull(inp.annual_return_pct)
  const feePct = numOrNull(inp.annual_fee_pct)

  if (pot === null || pot < 0) return false
  if (currentAge === null || currentAge < 18 || currentAge > 99) return false
  if (retAge === null || retAge <= currentAge || retAge > 99) return false
  if (targetEnd === null || targetEnd <= retAge || targetEnd > 110) return false
  if (returnPct === null || returnPct < 0) return false
  if (feePct === null || feePct < 0) return false
  // Require current_pot to be explicitly provided (not just empty string)
  if (String(inp.current_pot ?? '').trim() === '') return false
  return true
}

function buildRequestBody(inp) {
  return {
    current_pot: numOrNull(inp.current_pot, 0),
    current_age: numOrNull(inp.current_age),
    retirement_age: numOrNull(inp.retirement_age),
    monthly_contribution: numOrNull(inp.monthly_contribution, 0),
    annual_return_pct: numOrNull(inp.annual_return_pct, 7),
    annual_fee_pct: numOrNull(inp.annual_fee_pct, 0.75),
    inflation_rate_pct: numOrNull(inp.inflation_rate_pct, 2.5),
    lump_sum_type: inp.lump_sum_type || 'none',
    lump_sum_value: numOrNull(inp.lump_sum_value, 0),
    withdrawal_mode: inp.withdrawal_mode || 'percentage',
    withdrawal_value: numOrNull(inp.withdrawal_value, 4),
    target_end_age: numOrNull(inp.target_end_age, 95),
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export default function useDrawdownPlanner({ goal }) {
  const [inputs, setInputs] = useState(() => ({
    ...BASE_DEFAULTS,
    current_age: goal?.current_age != null ? String(goal.current_age) : '',
    retirement_age: goal?.target_age != null ? String(goal.target_age) : '',
    monthly_contribution:
      goal?.monthly_contribution != null ? String(goal.monthly_contribution) : '',
    annual_return_pct:
      goal?.expected_annual_return_pct != null
        ? String(goal.expected_annual_return_pct)
        : '7',
  }))

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [showRealTerms, setShowRealTerms] = useState(false)

  const debounceRef = useRef(null)
  const abortRef = useRef(null)

  const setInput = useCallback((key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }, [])

  const calculate = useCallback(async (inp) => {
    if (!inputsAreValid(inp)) {
      setResult(null)
      setError(null)
      return
    }

    if (abortRef.current) {
      try { abortRef.current.abort() } catch {}
    }
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const data = await api('/pension/plan', {
        method: 'POST',
        body: buildRequestBody(inp),
        signal: abortRef.current.signal,
        skipCache: true,
      })
      setResult(data)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err?.detail || err?.message || 'Calculation failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce recalculation whenever inputs change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => calculate(inputs), 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [inputs, calculate])

  // Sync from goal when it first loads (don't overwrite user edits)
  useEffect(() => {
    if (!goal) return
    setInputs((prev) => ({
      ...prev,
      current_age:
        prev.current_age || (goal.current_age != null ? String(goal.current_age) : ''),
      retirement_age:
        prev.retirement_age || (goal.target_age != null ? String(goal.target_age) : ''),
      monthly_contribution:
        prev.monthly_contribution ||
        (goal.monthly_contribution != null ? String(goal.monthly_contribution) : ''),
      annual_return_pct:
        prev.annual_return_pct ||
        (goal.expected_annual_return_pct != null
          ? String(goal.expected_annual_return_pct)
          : '7'),
    }))
  }, [goal?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    inputs,
    setInput,
    result,
    loading,
    error,
    showAssumptions,
    setShowAssumptions,
    showRealTerms,
    setShowRealTerms,
    isValid: inputsAreValid(inputs),
  }
}
