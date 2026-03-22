import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, invalidatePath } from '../../api'

function requiredMonthlyContribution({ pv, fv, yearsRemaining, annualReturnPct }) {
  const n = Math.max(0, Math.round((yearsRemaining || 0) * 12))
  if (!n) return null
  if (pv >= fv) return 0

  const er = Number(annualReturnPct || 0)
  const r = er / 100 / 12
  if (!Number.isFinite(r)) return null

  if (r === 0) return Math.max(0, (fv - pv) / n)

  const pow = Math.pow(1 + r, n)
  const denom = (pow - 1) / r
  if (!Number.isFinite(denom) || denom === 0) return null

  const pmt = (fv - pv * pow) / denom
  return Math.max(0, pmt)
}

export default function useOutlookForecast({
  goalId,
  primaryGoal,
  baseCurrency,
  settingsReady,
  isPro,
  deflate,
  numFrom,
  showToast,
  loadPrimaryGoal,
  bumpData,
  track,
}) {
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [localContrib, setLocalContrib] = useState('')
  const [localReturn, setLocalReturn] = useState('')
  const [dirty, setDirty] = useState(false)

  const [whatIf, setWhatIf] = useState(null)
  const whatIfTimer = useRef(null)

  const forecastRef = useRef(null)
  const justAppliedRef = useRef(false)
  const lastWhatIfKeyRef = useRef('')
  const lastForecastKeyRef = useRef('')
  const inflightForecastRef = useRef(new Map())
  const goalHealAttemptedRef = useRef(false)

  const [feedback, setFeedback] = useState(null)
  const feedbackTimer = useRef(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    name: 'Retirement',
    current_age: '',
    target_age: '60',
    target_amount: '',
    expected_annual_return_pct: '7',
    monthly_contribution: '0',
  })

  const [forecastVersion, setForecastVersion] = useState(0)

  const fetchForecast = useCallback(
    async (mc, er) => {
      if (!goalId) return null
      let url = `/goals/${goalId}/forecast`
      const params = []
      if (mc !== undefined && mc !== '') params.push(`monthly_contribution=${encodeURIComponent(mc)}`)
      if (er !== undefined && er !== '') params.push(`expected_return=${encodeURIComponent(er)}`)
      if (params.length) url += `?${params.join('&')}`
      return await api(url)
    },
    [goalId]
  )

  const loadForecast = useCallback(
    async (mc, er, { force = false } = {}) => {
      if (!goalId) return null

      const mcKey = mc === undefined || mc === '' ? '' : String(mc)
      const erKey = er === undefined || er === '' ? '' : String(er)
      const key = `${goalId}|${mcKey}|${erKey}`

      if (!force && lastForecastKeyRef.current === key && forecastRef.current) {
        return forecastRef.current
      }

      if (!force && inflightForecastRef.current.has(key)) {
        return await inflightForecastRef.current.get(key)
      }

      setError(null)

      const p = (async () => {
        const d = await fetchForecast(mc, er)
        lastForecastKeyRef.current = key
        forecastRef.current = d
        setForecast(d)
        setForecastVersion((v) => v + 1)
        return d
      })()

      inflightForecastRef.current.set(key, p)
      try {
        return await p
      } catch (e) {
        console.error('Outlook forecast error:', e)
        setError(e?.message || 'Failed to load forecast')
        return null
      } finally {
        inflightForecastRef.current.delete(key)
      }
    },
    [goalId, fetchForecast]
  )

  const loadWhatIf = useCallback(
    async (mc, er) => {
      if (!goalId) return
      if (!settingsReady || !isPro) return

      const baseMc = numFrom(mc, 0)
      const baseEr = numFrom(er, 0)

      if (!Number.isFinite(baseEr) || baseEr <= 0) {
        setWhatIf(null)
        return
      }

      try {
        const mc100 = baseMc + 100
        const mc250 = baseMc + 250

        const [plus100, plus250] = await Promise.all([
          fetchForecast(mc100, baseEr),
          fetchForecast(mc250, baseEr),
        ])

        setWhatIf(plus100 && plus250 ? { plus100, plus250 } : null)
      } catch {
        setWhatIf(null)
      }
    },
    [goalId, settingsReady, isPro, fetchForecast, numFrom]
  )

  useEffect(() => {
    if (!settingsReady) return
    if (primaryGoal !== undefined) return
    if (goalHealAttemptedRef.current) return
    goalHealAttemptedRef.current = true
    loadPrimaryGoal?.()
  }, [settingsReady, primaryGoal, loadPrimaryGoal])

  useEffect(() => {
    if (primaryGoal === undefined) return

    if (justAppliedRef.current) {
      justAppliedRef.current = false
      return
    }

    let cancelled = false

    ;(async () => {
      if (!primaryGoal) {
        forecastRef.current = null
        setForecast(null)
        setWhatIf(null)
        setLoading(false)
        return
      }

      const seededMc = String(primaryGoal.monthly_contribution ?? 0)
      const seededEr = String(primaryGoal.expected_annual_return_pct ?? 7)

      setLocalContrib(seededMc)
      setLocalReturn(seededEr)

      setEditForm({
        name: primaryGoal.name || 'Retirement',
        current_age: String(primaryGoal.current_age ?? ''),
        target_age: String(primaryGoal.target_age ?? '60'),
        target_amount: String(primaryGoal.target_amount ?? ''),
        expected_annual_return_pct: String(primaryGoal.expected_annual_return_pct ?? 7),
        monthly_contribution: String(primaryGoal.monthly_contribution ?? 0),
      })

      setLoading(true)
      try {
        await loadForecast(seededMc, seededEr)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })().catch((e) => {
      console.error('Seed forecast load failed:', e)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [primaryGoal, goalId, loadForecast])

  useEffect(() => {
    if (!settingsReady || !isPro) return
    if (!goalId) return
    if (!forecastVersion) return

    const key = `${goalId}|${localContrib}|${localReturn}`
    if (lastWhatIfKeyRef.current === key) return
    lastWhatIfKeyRef.current = key

    if (whatIfTimer.current) clearTimeout(whatIfTimer.current)
    whatIfTimer.current = setTimeout(() => {
      loadWhatIf(localContrib, localReturn)
    }, 450)

    return () => {
      if (whatIfTimer.current) clearTimeout(whatIfTimer.current)
    }
  }, [settingsReady, isPro, goalId, localContrib, localReturn, loadWhatIf, forecastVersion])

  const showFeedback = useCallback((msg) => {
    setFeedback(msg)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2600)
  }, [])

  const retryForecast = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await loadForecast(localContrib, localReturn)
    } finally {
      setLoading(false)
    }
  }, [loadForecast, localContrib, localReturn])

  const applyAssumptions = useCallback(
    async ({ mcOverride = null, erOverride = null } = {}) => {
      if (!goalId) return

      const mc = mcOverride != null ? mcOverride : numFrom(localContrib, 0)
      const er = erOverride != null ? erOverride : numFrom(localReturn, 0)
      const prevStatus = forecast?.status

      setLoading(true)
      setError(null)

      try {
        await api(`/goals/${goalId}`, {
          method: 'PATCH',
          body: {
            monthly_contribution: mc,
            expected_annual_return_pct: er,
          },
        })

        track('goal_updated', {
          page: 'plan',
          entityType: 'goal',
          entityId: goalId,
          source: 'assumptions_update',
        })

        setDirty(false)

        invalidatePath('/goals/primary', `/goals/${goalId}/forecast`)

        const newForecast = await loadForecast(mc, er, { force: true })

        if (
          newForecast &&
          (newForecast.status === 'on_track' || newForecast.status === 'ahead') &&
          prevStatus === 'adjust'
        ) {
          showFeedback("You're now on track.")
        } else {
          showFeedback('Updated')
        }

        justAppliedRef.current = true
        Promise.resolve()
          .then(async () => {
            await loadPrimaryGoal?.()
            bumpData?.()
          })
          .catch(() => {})
      } catch (e) {
        console.error(e)
        showToast(e?.message || String(e), 'error')
      } finally {
        setLoading(false)
      }
    },
    [
      goalId,
      localContrib,
      localReturn,
      forecast?.status,
      loadForecast,
      loadPrimaryGoal,
      bumpData,
      showToast,
      numFrom,
      showFeedback,
      track,
    ]
  )

  const openEdit = useCallback(() => {
    const g = forecast?.goal || primaryGoal
    if (!g) return

    setEditForm({
      name: g.name || 'Retirement',
      current_age: String(g.current_age ?? ''),
      target_age: String(g.target_age ?? '60'),
      target_amount: String(g.target_amount ?? ''),
      expected_annual_return_pct: String(g.expected_annual_return_pct ?? 7),
      monthly_contribution: String(g.monthly_contribution ?? 0),
    })
    setEditOpen(true)
  }, [forecast, primaryGoal])

  const closeEdit = useCallback(() => setEditOpen(false), [])

  const updateEdit = useCallback((field, value) => {
    setEditForm((f) => ({ ...f, [field]: value }))
  }, [])

  const saveEditPlan = useCallback(async () => {
    if (!goalId) return

    if (
      !String(editForm.current_age || '').trim() ||
      !String(editForm.target_age || '').trim() ||
      !String(editForm.target_amount || '').trim()
    ) {
      showToast('Please fill in current age, target age and target amount', 'error')
      return
    }

    const payload = {
      name: editForm.name,
      current_age: numFrom(editForm.current_age, 0),
      target_age: numFrom(editForm.target_age, 0),
      target_amount: numFrom(editForm.target_amount, 0),
      monthly_contribution: numFrom(editForm.monthly_contribution, 0),
      expected_annual_return_pct: numFrom(editForm.expected_annual_return_pct, 0),
    }

    try {
      setEditSaving(true)

      await api(`/goals/${goalId}`, { method: 'PATCH', body: payload })

      track('goal_updated', {
        page: 'plan',
        entityType: 'goal',
        entityId: goalId,
        source: 'edit_plan_save',
      })

      showToast('Plan updated', 'success')

      setEditOpen(false)
      setLoading(true)

      invalidatePath('/goals/primary', `/goals/${goalId}/forecast`)
      await loadForecast(payload.monthly_contribution, payload.expected_annual_return_pct, { force: true })

      justAppliedRef.current = true
      Promise.resolve()
        .then(async () => {
          await loadPrimaryGoal?.()
        })
        .catch(() => {})
    } catch (e) {
      console.error(e)
      showToast(e?.message || String(e), 'error')
    } finally {
      setEditSaving(false)
      setLoading(false)
    }
  }, [goalId, editForm, showToast, numFrom, track, loadForecast, loadPrimaryGoal])

  const derived = useMemo(() => {
    const goal = forecast?.goal || primaryGoal || null
    const ccy = (forecast?.base_currency || baseCurrency || 'GBP').toUpperCase()

    const status = forecast?.status || 'on_track'
    const projEnd = Number(forecast?.projected_end_value || 0)
    const targetAmt = Number(goal?.target_amount || 0)
    const yearsRemaining = Number(forecast?.years_remaining || 0)
    const currentNW = Number(forecast?.current_net_worth || 0)

    const freedom = forecast?.freedom || null
    const freedomYearNum = freedom?.hit_year != null ? Number(freedom.hit_year) : null
    const yearsToGoal = freedom?.years_to_goal ?? null
    const hitMonth = freedom?.hit_month ?? null
    const currentAge = goal?.current_age ?? null

    const freedomAge =
      hitMonth != null && currentAge != null
        ? Math.round((Number(currentAge) + Number(hitMonth) / 12) * 10) / 10
        : null

    const plus100Year =
      whatIf?.plus100?.freedom?.hit_year != null ? Number(whatIf.plus100.freedom.hit_year) : null
    const plus250Year =
      whatIf?.plus250?.freedom?.hit_year != null ? Number(whatIf.plus250.freedom.hit_year) : null

    const displayProjEnd = deflate(projEnd, yearsRemaining)
    const displayTarget = targetAmt

    const gap = displayTarget - displayProjEnd
    const absGap = Math.abs(gap)

    const currentMc = numFrom(localContrib, 0)
    const annualEr = numFrom(localReturn, 0)

    const reqMc =
      settingsReady && isPro && targetAmt > 0 && yearsRemaining > 0
        ? requiredMonthlyContribution({
            pv: currentNW,
            fv: targetAmt,
            yearsRemaining,
            annualReturnPct: annualEr,
          })
        : null

    const deltaMc = reqMc != null ? Math.max(0, reqMc - currentMc) : null

    return {
      goal,
      ccy,
      status,
      projEnd,
      targetAmt,
      yearsRemaining,
      currentNW,
      freedomYearNum,
      yearsToGoal,
      freedomAge,
      plus100Year,
      plus250Year,
      displayProjEnd,
      displayTarget,
      gap,
      absGap,
      reqMc,
      deltaMc,
    }
  }, [
    forecast,
    primaryGoal,
    baseCurrency,
    whatIf,
    deflate,
    localContrib,
    localReturn,
    settingsReady,
    isPro,
    numFrom,
  ])

  const chartData = useMemo(() => {
    const projPoints = forecast?.projected_points || []
    const reqPoints = forecast?.required_points || []
    const out = []

    for (let i = 0; i < projPoints.length; i++) {
      if (i === 0 || i % 6 === 0 || i === projPoints.length - 1) {
        const pp = projPoints[i]
        const rp = reqPoints[i] || {}
        const yearsOut = i / 12
        out.push({
          date: pp.date,
          label: new Date(pp.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
          projected: deflate(pp.value, yearsOut),
          required: rp.value ? deflate(rp.value, yearsOut) : null,
        })
      }
    }

    return out
  }, [forecast, deflate])

  return {
    forecast,
    loading,
    error,
    localContrib,
    setLocalContrib,
    localReturn,
    setLocalReturn,
    dirty,
    setDirty,
    whatIf,
    feedback,
    editOpen,
    editSaving,
    editForm,
    setEditForm,
    openEdit,
    closeEdit,
    updateEdit,
    saveEditPlan,
    retryForecast,
    applyAssumptions,
    derived,
    chartData,
  }
}