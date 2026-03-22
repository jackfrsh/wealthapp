import React, { useEffect, useMemo, useRef } from 'react'
import {
  GitCompare,
  Lock,
  Pencil,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { fmtCurrency, fmtCurrencyCompact } from '../../utils'
import { planTheme } from './planTheme'
import PlanSectionFrame from './PlanSectionFrame'

function numFrom(input, fallback = 0) {
  const n = Number(String(input ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

export default function ScenarioCompareCard({
  settingsReady,
  isPro,
  ccy,
  scenarios,
  compareCards,
  bestScenario,
  scenariosLoading,
  compareLoading,
  scenarioEditorOpen,
  editingScenarioId,
  scenarioForm,
  setScenarioForm,
  scenarioSaving,
  onAdd,
  onEdit,
  onDelete,
  onCloseEditor,
  onSaveScenario,
  onUpgrade,
  isOpen,
  onToggleOpen,
}) {
  const editorRef = useRef(null)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (!scenarioEditorOpen) return
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
  }, [scenarioEditorOpen])

  const winningScenarioInsight = useMemo(() => {
    if (!compareCards?.length) return null

    const byProjected = [...compareCards].sort((a, b) => b.projected - a.projected)[0]

    const validFreedom = compareCards.filter((c) => Number.isFinite(c.freedomYear))
    const byFreedom =
      validFreedom.length > 0
        ? [...validFreedom].sort((a, b) => a.freedomYear - b.freedomYear)[0]
        : null

    const winner = byFreedom && byFreedom.freedomYearsEarlier > 0 ? byFreedom : byProjected
    if (!winner) return null

    // Threshold: is the delta meaningful?
    const absDelta = Math.abs(winner.projectedDelta || 0)
    const deltaRatio = winner.projected > 0 ? absDelta / winner.projected : 0
    const isNegligible = deltaRatio < 0.01 // < 1% difference
    const isSmall = deltaRatio < 0.05      // < 5% difference

    let headline = ''
    let subline = `Projected at ${fmtCurrencyCompact(winner.projected, ccy)} by target age.`

    if (isNegligible && !(winner.freedomYearsEarlier > 0)) {
      headline = 'Scenarios project similar outcomes'
      subline = 'The differences are marginal at this point.'
    } else if (winner.freedomYear && winner.freedomYearsEarlier > 0) {
      headline = `${winner.name} gets you there sooner`
      subline = `${winner.freedomYearsEarlier} ${
        winner.freedomYearsEarlier === 1 ? 'year' : 'years'
      } earlier, with freedom projected in ${winner.freedomYear}.`
    } else if (winner.projectedDelta > 0) {
      headline = isSmall
        ? `${winner.name} edges ahead`
        : `${winner.name} is the leading scenario`
      subline = `${fmtCurrencyCompact(
        winner.projectedDelta,
        ccy
      )} ahead of your current plan by target age.`
    } else if (winner.projectedDelta < 0) {
      headline = `Current plan still leads`
      subline = `${fmtCurrencyCompact(
        Math.abs(winner.projectedDelta),
        ccy
      )} below your current plan by target age.`
    } else {
      headline = `${winner.name} is the leading scenario`
    }

    return {
      ...winner,
      headline,
      subline,
      isNegligible,
    }
  }, [compareCards, ccy])

  const applyPreset = (preset) => {
    const currentContribution = numFrom(scenarioForm.monthly_contribution, 0)

    if (preset.type === 'contribution_boost') {
      const nextContribution = currentContribution + preset.amount
      setScenarioForm((f) => ({
        ...f,
        name: f.name?.trim() || preset.defaultName,
        monthly_contribution: String(nextContribution),
      }))
      return
    }

    if (preset.type === 'return_set') {
      setScenarioForm((f) => ({
        ...f,
        name: f.name?.trim() || preset.defaultName,
        expected_annual_return_pct: String(preset.value),
      }))
    }
  }

  const presetButtons = [
    {
      type: 'contribution_boost',
      amount: 100,
      label: '+100/mo',
      defaultName: 'Higher Contributions',
    },
    {
      type: 'contribution_boost',
      amount: 250,
      label: '+250/mo',
      defaultName: 'Higher Contributions',
    },
    {
      type: 'return_set',
      value: 3,
      label: 'Conservative 3%',
      defaultName: 'Conservative Case',
    },
    {
      type: 'return_set',
      value: 7,
      label: 'Growth 7%',
      defaultName: 'Growth Case',
    },
  ]

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className={planTheme.eyebrowAccent}>
          <span className="inline-flex items-center gap-2">
            <GitCompare size={13} />
            Scenario compare
          </span>
        </div>
  
        <div className="mt-2 text-base font-semibold text-ink dark:text-white tracking-tight">
          Compare scenarios
        </div>
        <div className={`mt-1 ${planTheme.body}`}>
          Test different assumptions against your current plan.
        </div>
      </div>
  
      <div className="flex items-center gap-2 shrink-0">
        {isPro ? (
          <>
            <button type="button" onClick={onToggleOpen} className={planTheme.buttonSecondary}>
              {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {isOpen ? 'Hide' : 'Show'}
            </button>
  
            <button
              type="button"
              onClick={() => {
                if (!isOpen) onToggleOpen?.()
                onAdd()
              }}
              className={planTheme.buttonPrimary}
            >
              <Plus size={15} /> Add scenario
            </button>
          </>
        ) : (
          <button type="button" onClick={onUpgrade} className={planTheme.buttonUpgrade}>
            <Lock size={15} /> Unlock
          </button>
        )}
      </div>
    </div>
  )

  return (
    <PlanSectionFrame header={header}>
      {isPro && scenarioEditorOpen && (
        <div ref={editorRef} className="mb-5 pb-5 border-b border-black/[.05] dark:border-white/[.05]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className={planTheme.eyebrow}>
                {editingScenarioId ? 'Edit scenario' : 'New scenario'}
              </div>
              <div className={`mt-1 ${planTheme.body}`}>
                Save an alternative path and compare it to your current plan.
              </div>
            </div>

            <button
              onClick={onCloseEditor}
              className={planTheme.iconButton}
              aria-label="Close"
              type="button"
            >
              <X size={18} className="text-ink dark:text-white" />
            </button>
          </div>

          <div className="mb-5">
            <div className={`${planTheme.eyebrow} mb-2`}>Quick presets</div>
            <div className="flex flex-wrap gap-2">
              {presetButtons.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={planTheme.pillButton}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className={planTheme.fieldLabel}>Scenario name</label>
              <input
                ref={nameInputRef}
                value={scenarioForm.name}
                onChange={(e) => setScenarioForm((f) => ({ ...f, name: e.target.value }))}
                className={planTheme.fieldInput}
                placeholder="Higher Contributions"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <div>
                <label className={planTheme.fieldLabel}>Monthly contribution ({ccy})</label>
                <input
                  value={scenarioForm.monthly_contribution}
                  onChange={(e) =>
                    setScenarioForm((f) => ({ ...f, monthly_contribution: e.target.value }))
                  }
                  className={planTheme.fieldInput}
                  placeholder="1000"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className={planTheme.fieldLabel}>Expected annual return (%)</label>
                <input
                  value={scenarioForm.expected_annual_return_pct}
                  onChange={(e) =>
                    setScenarioForm((f) => ({
                      ...f,
                      expected_annual_return_pct: e.target.value,
                    }))
                  }
                  className={planTheme.fieldInput}
                  placeholder="7"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div>
              <label className={planTheme.fieldLabel}>Notes (optional)</label>
              <textarea
                value={scenarioForm.notes}
                onChange={(e) => setScenarioForm((f) => ({ ...f, notes: e.target.value }))}
                className={`${planTheme.fieldInput} min-h-[110px] resize-none`}
                placeholder="What is this scenario testing?"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={onCloseEditor} className={planTheme.buttonSecondary} type="button">
                Cancel
              </button>

              <button
                onClick={onSaveScenario}
                disabled={!String(scenarioForm.name || '').trim() || scenarioSaving}
                className={`${planTheme.buttonPrimary} disabled:opacity-40`}
                type="button"
              >
                {scenarioSaving ? 'Saving…' : 'Save scenario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!settingsReady ? null : !isPro ? (
        <div>
          <div className={planTheme.title}>Saved scenario planning</div>
          <div className={`mt-1 ${planTheme.body}`}>
            Build multiple future paths and see which one reaches your target sooner.
          </div>
        </div>
      ) : !isOpen ? null : scenariosLoading || compareLoading ? (
        <div className="space-y-5">
          <div>
            <div className="h-4 w-48 rounded skeleton opacity-25 mb-3" />
            <div className="h-3 w-64 rounded skeleton opacity-15" />
          </div>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="py-3">
                <div className="h-3.5 w-32 rounded skeleton opacity-20 mb-2" />
                <div className="h-5 w-24 rounded skeleton opacity-18" />
              </div>
            ))}
          </div>
        </div>
      ) : !compareCards.length ? (
        <div>
          <div className={planTheme.title}>No saved scenarios yet</div>
          <div className={`mt-1 ${planTheme.body}`}>
            Start with a “Higher Contributions” or “Conservative Return” scenario.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Recommendation summary ── */}
          {winningScenarioInsight && (
            <div>
              <div className="text-lg font-semibold leading-snug text-ink dark:text-white">
                {winningScenarioInsight.headline}
              </div>
              <div className={`mt-1.5 ${planTheme.body} max-w-[34rem]`}>
                {winningScenarioInsight.subline}
              </div>

              {/* Metric band — one soft grouped row, not separate cards */}
              {!winningScenarioInsight.isNegligible && (
                <div className="mt-4 flex items-stretch rounded-lg bg-black/[.015] dark:bg-white/[.025] overflow-hidden">
                  <div className="flex-1 min-w-0 px-4 py-3">
                    <div className="text-[10.5px] font-semibold tracking-[.12em] uppercase text-ink-muted/50 dark:text-white/25 mb-1">
                      Projected
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-ink dark:text-white">
                      {fmtCurrencyCompact(winningScenarioInsight.projected, ccy)}
                    </div>
                  </div>
                  <div className="w-px bg-black/[.06] dark:bg-white/[.06] my-2.5 shrink-0" />
                  <div className="flex-1 min-w-0 px-4 py-3">
                    <div className="text-[10.5px] font-semibold tracking-[.12em] uppercase text-ink-muted/50 dark:text-white/25 mb-1">
                      vs plan
                    </div>
                    <div className={`text-sm font-semibold tabular-nums ${
                      winningScenarioInsight.projectedDelta >= 0
                        ? 'text-gain dark:text-emerald-300/80'
                        : 'text-red-500 dark:text-red-300/80'
                    }`}>
                      {winningScenarioInsight.projectedDelta >= 0 ? '+' : ''}
                      {fmtCurrencyCompact(winningScenarioInsight.projectedDelta, ccy)}
                    </div>
                  </div>
                  <div className="w-px bg-black/[.06] dark:bg-white/[.06] my-2.5 shrink-0" />
                  <div className="flex-1 min-w-0 px-4 py-3">
                    <div className="text-[10.5px] font-semibold tracking-[.12em] uppercase text-ink-muted/50 dark:text-white/25 mb-1">
                      Freedom
                    </div>
                    <div className="text-sm font-semibold text-ink dark:text-white">
                      {winningScenarioInsight.freedomYear || 'Off target'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Scenario rows ── */}
          <div className="divide-y divide-black/[.05] dark:divide-white/[.05]">
            {compareCards.map((card) => {
              const scenario = scenarios.find((s) => s.id === card.id)
              const isWinner = bestScenario?.id === card.id

              return (
                <div key={card.id} className="py-4 first:pt-0 last:pb-0">
                  {/* Identity line: name + badge + actions */}
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-sm font-semibold text-ink dark:text-white truncate">
                        {card.name}
                      </div>
                      {isWinner && (
                        <span className="text-[10px] font-semibold tracking-[.06em] uppercase text-accent/70 dark:text-blue-300/60 shrink-0">
                          Best
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEdit(scenario)}
                        className={planTheme.iconButton}
                        aria-label="Edit scenario"
                      >
                        <Pencil size={14} className="text-ink-muted/45 dark:text-white/30" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(card.id)}
                        className={planTheme.iconButton}
                        aria-label="Delete scenario"
                      >
                        <Trash2 size={14} className="text-ink-muted/45 dark:text-white/30" />
                      </button>
                    </div>
                  </div>

                  {/* Assumptions */}
                  <div className="text-xs text-ink-muted/50 dark:text-white/28 mb-2.5">
                    {fmtCurrency(card.monthlyContribution, ccy)}/mo · {card.expectedReturn}% return
                  </div>

                  {/* Outcome grid — aligned columns across rows */}
                  <div className="grid grid-cols-3 gap-x-4">
                    <div>
                      <div className="text-[10.5px] font-semibold tracking-[.12em] uppercase text-ink-muted/45 dark:text-white/22 mb-0.5">
                        Projected
                      </div>
                      <div className="text-sm font-semibold tabular-nums text-ink dark:text-white">
                        {fmtCurrencyCompact(card.projected, ccy)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-semibold tracking-[.12em] uppercase text-ink-muted/45 dark:text-white/22 mb-0.5">
                        vs plan
                      </div>
                      <div className={`text-sm font-semibold tabular-nums ${
                        card.projectedDelta >= 0
                          ? 'text-gain/80 dark:text-emerald-300/70'
                          : 'text-red-500/80 dark:text-red-300/70'
                      }`}>
                        {card.projectedDelta >= 0 ? '+' : ''}
                        {fmtCurrencyCompact(card.projectedDelta, ccy)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-semibold tracking-[.12em] uppercase text-ink-muted/45 dark:text-white/22 mb-0.5">
                        Freedom
                      </div>
                      <div className="text-sm font-semibold text-ink/80 dark:text-white/55">
                        {card.freedomYear ? (
                          <>
                            {card.freedomYear}
                            {card.freedomYearsEarlier > 0 && (
                              <span className="text-gain/65 dark:text-emerald-300/50 text-xs ml-1">
                                {card.freedomYearsEarlier}y earlier
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-muted/40 dark:text-white/22 font-normal">Off target</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {card.notes && (
                    <div className="mt-2 text-xs text-ink-muted/40 dark:text-white/22 leading-relaxed">
                      {card.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </PlanSectionFrame>
  )
}