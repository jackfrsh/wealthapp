import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, invalidatePath } from '../../api'

function numFrom(input, fallback = 0) {
  const n = Number(String(input ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

export default function useScenarioCompare({
  goalId,
  forecast,
  settingsReady,
  isPro,
  localContrib,
  localReturn,
  showToast,
  isActive,
}) {
  const [scenarios, setScenarios] = useState([])
  const [scenariosLoading, setScenariosLoading] = useState(false)
  const [compareLoading, setCompareLoading] = useState(false)
  const [scenarioForecastResults, setScenarioForecastResults] = useState([])

  const [scenarioEditorOpen, setScenarioEditorOpen] = useState(false)
  const [scenarioSaving, setScenarioSaving] = useState(false)
  const [editingScenarioId, setEditingScenarioId] = useState(null)
  const [scenarioForm, setScenarioForm] = useState({
    name: '',
    monthly_contribution: '',
    expected_annual_return_pct: '',
    notes: '',
  })

  const loadScenarios = useCallback(async () => {
    if (!goalId) return
    if (!settingsReady || !isPro) {
      setScenarios([])
      setScenarioForecastResults([])
      return
    }

    setScenariosLoading(true)
    try {
      const data = await api('/projection/scenarios', {
        nullOn404: false,
        skipCache: true,
      })
      setScenarios(data?.items || [])
    } catch (e) {
      console.error('Scenario load error:', e)
      setScenarios([])
    } finally {
      setScenariosLoading(false)
    }
  }, [goalId, settingsReady, isPro])

  const resetScenarioForm = useCallback(() => {
    setEditingScenarioId(null)
    setScenarioForm({
      name: '',
      monthly_contribution: String(numFrom(localContrib, 0)),
      expected_annual_return_pct: String(numFrom(localReturn, 0)),
      notes: '',
    })
  }, [localContrib, localReturn])

  const openNewScenario = useCallback(() => {
    resetScenarioForm()
    setScenarioEditorOpen(true)
  }, [resetScenarioForm])

  const openEditScenario = useCallback((scenario) => {
    if (!scenario) return
    setEditingScenarioId(scenario.id)
    setScenarioForm({
      name: scenario.name || '',
      monthly_contribution: String(scenario.monthly_contribution ?? 0),
      expected_annual_return_pct: String(scenario.expected_annual_return_pct ?? 7),
      notes: scenario.notes || '',
    })
    setScenarioEditorOpen(true)
  }, [])

  const closeScenarioEditor = useCallback(() => {
    setScenarioEditorOpen(false)
    setEditingScenarioId(null)
    setScenarioForm({
      name: '',
      monthly_contribution: String(numFrom(localContrib, 0)),
      expected_annual_return_pct: String(numFrom(localReturn, 0)),
      notes: '',
    })
  }, [localContrib, localReturn])

  const saveScenario = useCallback(async () => {
    const payload = {
      name: String(scenarioForm.name || '').trim(),
      monthly_contribution: numFrom(scenarioForm.monthly_contribution, 0),
      expected_annual_return_pct: numFrom(scenarioForm.expected_annual_return_pct, 0),
      notes: String(scenarioForm.notes || '').trim() || null,
    }

    if (!payload.name) {
      showToast('Please give the scenario a name', 'error')
      return
    }

    setScenarioSaving(true)
    try {
      if (editingScenarioId) {
        await api(`/projection/scenarios/${editingScenarioId}`, {
          method: 'PATCH',
          body: payload,
        })
      } else {
        await api('/projection/scenarios', {
          method: 'POST',
          body: payload,
        })
      }

      invalidatePath('/projection/scenarios')
      await loadScenarios()
      closeScenarioEditor()
      showToast(editingScenarioId ? 'Scenario updated' : 'Scenario saved', 'success')
    } catch (e) {
      console.error(e)
      showToast(e?.message || 'Failed to save scenario', 'error')
    } finally {
      setScenarioSaving(false)
    }
  }, [scenarioForm, editingScenarioId, loadScenarios, closeScenarioEditor, showToast])

  const deleteScenario = useCallback(
    async (scenarioId) => {
      try {
        await api(`/projection/scenarios/${scenarioId}`, { method: 'DELETE' })
        invalidatePath('/projection/scenarios')
        await loadScenarios()
        showToast('Scenario deleted', 'success')
      } catch (e) {
        console.error(e)
        showToast(e?.message || 'Failed to delete scenario', 'error')
      }
    },
    [loadScenarios, showToast]
  )

  const loadScenarioForecasts = useCallback(async () => {
    if (!goalId || !forecast || !settingsReady || !isPro) {
      setScenarioForecastResults([])
      return
    }

    if (!scenarios.length) {
      setScenarioForecastResults([])
      return
    }

    setCompareLoading(true)
    try {
      const results = await Promise.all(
        scenarios.map(async (scenario) => {
          const params = new URLSearchParams({
            monthly_contribution: String(scenario.monthly_contribution ?? 0),
            expected_return: String(scenario.expected_annual_return_pct ?? 7),
          })

          const res = await api(`/goals/${goalId}/forecast?${params.toString()}`, {
            skipCache: true,
          })

          return {
            scenario,
            forecast: res,
          }
        })
      )

      setScenarioForecastResults(results)
    } catch (e) {
      console.error('Scenario compare error:', e)
      setScenarioForecastResults([])
    } finally {
      setCompareLoading(false)
    }
  }, [goalId, forecast, settingsReady, isPro, scenarios])

  useEffect(() => {
    if (!settingsReady) return
    if (!goalId) return
    if (!isPro) return
    loadScenarios()
  }, [settingsReady, goalId, isPro, loadScenarios])

  useEffect(() => {
    if (!settingsReady || !isPro) return
    if (!isActive) return
    if (!goalId) return
    if (!forecast) return
    loadScenarioForecasts()
  }, [settingsReady, isPro, isActive, goalId, forecast, scenarios, loadScenarioForecasts])

  const compareCards = useMemo(() => {
    if (!forecast || !scenarioForecastResults.length) return []

    const baseProjected = Number(forecast?.projected_end_value || 0)
    const baseFreedomYear =
      forecast?.freedom?.hit_year != null ? Number(forecast.freedom.hit_year) : null

    const cards = scenarioForecastResults.map(({ scenario, forecast: scenarioForecast }) => {
      const projected = Number(scenarioForecast?.projected_end_value || 0)
      const projectedDelta = projected - baseProjected

      const freedomYear =
        scenarioForecast?.freedom?.hit_year != null
          ? Number(scenarioForecast.freedom.hit_year)
          : null

      const freedomYearsEarlier =
        baseFreedomYear != null && freedomYear != null && freedomYear < baseFreedomYear
          ? baseFreedomYear - freedomYear
          : 0

      return {
        id: scenario.id,
        name: scenario.name,
        monthlyContribution: Number(scenario.monthly_contribution || 0),
        expectedReturn: Number(scenario.expected_annual_return_pct || 0),
        projected,
        projectedDelta,
        freedomYear,
        freedomYearsEarlier,
        notes: scenario.notes || '',
        forecast: scenarioForecast,
      }
    })

    return cards.sort((a, b) => {
      const aScore = (a.freedomYearsEarlier || 0) * 1_000_000 + (a.projectedDelta || 0)
      const bScore = (b.freedomYearsEarlier || 0) * 1_000_000 + (b.projectedDelta || 0)
      return bScore - aScore
    })
  }, [forecast, scenarioForecastResults])

  const bestScenario = compareCards.length ? compareCards[0] : null

  return {
    scenarios,
    scenariosLoading,
    compareLoading,
    compareCards,
    bestScenario,
    scenarioEditorOpen,
    scenarioSaving,
    editingScenarioId,
    scenarioForm,
    setScenarioForm,
    openNewScenario,
    openEditScenario,
    closeScenarioEditor,
    saveScenario,
    deleteScenario,
  }
}