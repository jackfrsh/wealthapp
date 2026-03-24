import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'

const FREE_HORIZON = 1
const DEFAULT_PRO_HORIZON = 25
const PRO_HORIZONS_BASE = [1, 5, 10, 15, 20, 25, 30, 40]

function clampProjectionYears(years, isPro, fallback = DEFAULT_PRO_HORIZON) {
  const n = Number(years)
  if (!Number.isFinite(n)) return isPro ? fallback : FREE_HORIZON
  if (!isPro) return FREE_HORIZON
  return Math.max(1, Math.min(40, Math.round(n)))
}

export default function useProjectionData({
  settingsReady,
  isPro,
  projOpen,
  deflate,
  defaultProjYears,
}) {
  const [projData, setProjData] = useState(null)
  const [projHistory, setProjHistory] = useState([])
  const [projYearsState, setProjYearsState] = useState(DEFAULT_PRO_HORIZON)
  const [projLoading, setProjLoading] = useState(false)

  const userSetProjYearsRef = useRef(false)

  const seededProjYears = useMemo(() => {
    return clampProjectionYears(defaultProjYears, isPro, DEFAULT_PRO_HORIZON)
  }, [defaultProjYears, isPro])

  const HORIZONS = useMemo(() => {
    if (!(settingsReady && isPro)) return [1]
    return Array.from(new Set([...PRO_HORIZONS_BASE, seededProjYears])).sort((a, b) => a - b)
  }, [settingsReady, isPro, seededProjYears])

  const projYears = settingsReady && isPro ? projYearsState : FREE_HORIZON
  const effectiveProjYears = settingsReady && isPro ? projYears : FREE_HORIZON

  const setProjYears = useCallback((years) => {
    userSetProjYearsRef.current = true
    setProjYearsState(clampProjectionYears(years, isPro, DEFAULT_PRO_HORIZON))
  }, [isPro])

  const loadProjections = useCallback(async (years) => {
    const horizon = years ?? FREE_HORIZON
    setProjLoading(true)

    try {
      const days = Math.max(365, Math.round(horizon * 365))
      const [proj, hist] = await Promise.all([
        api(`/projection/networth?years=${horizon}`),
        api(`/history/networth?days=${days}`),
      ])
      setProjData(proj)
      setProjHistory(hist.points || [])
    } catch (e) {
      console.error('Projections load error:', e)
    } finally {
      setProjLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!settingsReady) return
    if (userSetProjYearsRef.current) return
    setProjYearsState(seededProjYears)
  }, [settingsReady, seededProjYears])

  useEffect(() => {
    if (!projOpen) return
    if (!settingsReady) return
    loadProjections(effectiveProjYears)
  }, [projOpen, settingsReady, effectiveProjYears, loadProjections])

  const projChartData = useMemo(() => {
    if (!projData) return []

    const pHist = projHistory || []
    const pPoints = projData.points || []
    const out = []

    for (const h of pHist) {
      out.push({ date: h.date, actual: h.net_worth, projected: null })
    }

    for (let i = 0; i < pPoints.length; i++) {
      if (i === 0 || i % 3 === 0 || i === pPoints.length - 1) {
        const yearsOut = i / 12
        out.push({
          date: pPoints[i].date,
          actual: null,
          projected: deflate(pPoints[i].value, yearsOut),
        })
      }
    }

    out.sort((a, b) => new Date(a.date) - new Date(b.date))
    return out
  }, [projData, projHistory, deflate])

  const milestones = projData?.milestones || []

  const filteredMilestones = useMemo(() => {
    const all = milestones
      .filter((m) => m.year <= effectiveProjYears)
      .sort((a, b) => a.year - b.year)

    if (!all.length) return []

    const yearsForHorizon = (h) => {
      if (h <= 1) return [1]
      if (h <= 5) return [1, 2, 3, 5]
      if (h <= 10) return [1, 3, 5, 10]
      if (h <= 15) return [3, 5, 10, 15]
      if (h <= 20) return [5, 10, 15, 20]
      if (h <= 25) return [5, 10, 20, 25]
      if (h <= 30) return [5, 10, 20, 30]
      return [10, 20, 30, 40]
    }

    const wantYears = yearsForHorizon(effectiveProjYears).filter((y) => y <= effectiveProjYears)

    const pickForYear = (y) => {
      const exact = all.find((m) => m.year === y)
      if (exact) return exact
      for (let i = all.length - 1; i >= 0; i--) {
        if (all[i].year < y) return all[i]
      }
      return all[0]
    }

    const picked = []
    for (const y of wantYears) {
      const m = pickForYear(y)
      if (m && !picked.some((p) => p.year === m.year)) picked.push(m)
    }

    const last = all[all.length - 1]
    if (last && !picked.some((p) => p.year === last.year)) picked.push(last)

    return picked.slice(0, 4)
  }, [milestones, effectiveProjYears])

  return {
    projData,
    projYears,
    setProjYears,
    projLoading,
    HORIZONS,
    effectiveProjYears,
    projChartData,
    filteredMilestones,
  }
}