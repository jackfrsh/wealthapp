import React, { useEffect, useMemo, useRef } from 'react'
import {
  Crown,
  GitCompare,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  CalendarClock,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import Card from '../Card'
import { fmtCurrency, fmtCurrencyCompact } from '../../utils'
import { planTheme } from './planTheme'

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

    const projectedDeltaPositive = winner.projectedDelta > 0
    const projectedDeltaNegative = winner.projectedDelta < 0

    let headline = `${winner.name} looks strongest`
    let subline = `Projected at ${fmtCurrencyCompact(winner.projected, ccy)} by target age.`

    if (winner.freedomYear && winner.freedomYearsEarlier > 0) {
      headline = `${winner.name} gets you there sooner`
      subline = `${winner.freedomYearsEarlier} ${
        winner.freedomYearsEarlier === 1 ? 'year' : 'years'
      } earlier, with freedom projected in ${winner.freedomYear}.`
    } else if (projectedDeltaPositive) {
      subline = `${fmtCurrencyCompact(
        winner.projectedDelta,
        ccy
      )} ahead of your current plan by target age.`
    } else if (projectedDeltaNegative) {
      subline = `${fmtCurrencyCompact(
        Math.abs(winner.projectedDelta),
        ccy
      )} below your current plan by target age.`
    }

    return {
      ...winner,
      headline,
      subline,
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

  return (
    <Card className={`${planTheme.sectionCard} overflow-hidden`}>
      <div
        className={`px-4 sm:px-6 py-5 border-b ${planTheme.divider} flex items-center justify-between gap-4`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <GitCompare size={16} className="text-accent" />
            <h3 className={planTheme.title}>Scenario Compare</h3>
            {!isPro && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <Crown size={10} /> Pro
              </span>
            )}
          </div>

          <div className={`mt-1 ${planTheme.body}`}>
            Compare contribution and return assumptions against your current plan.
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

      {isOpen && (
        <div className="px-4 sm:px-6 py-5">
          {isPro && scenarioEditorOpen && (
            <div ref={editorRef} className={`${planTheme.sectionCardSoft} mb-5 p-5 sm:p-6`}>
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
            <div className={`${planTheme.sectionCardSoft} p-5`}>
              <div className={planTheme.title}>Saved scenario planning</div>
              <div className={`mt-1 ${planTheme.body}`}>
                Build multiple future paths and see which one reaches your target sooner.
              </div>
            </div>
          ) : scenariosLoading || compareLoading ? (
            <div className="space-y-4">
              <div className={`${planTheme.sectionCardSoft} p-5`}>
                <div className="h-4 w-40 rounded skeleton mb-3" />
                <div className="h-8 w-56 rounded skeleton mb-3" />
                <div className="h-3 w-48 rounded skeleton" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className={`${planTheme.sectionCardSoft} p-5`}>
                    <div className="h-4 w-32 rounded skeleton mb-3" />
                    <div className="h-8 w-40 rounded skeleton mb-3" />
                    <div className="h-3 w-24 rounded skeleton mb-2" />
                    <div className="h-3 w-32 rounded skeleton" />
                  </div>
                ))}
              </div>
            </div>
          ) : !compareCards.length ? (
            <div className={`${planTheme.sectionCardSoft} p-5`}>
              <div className={planTheme.title}>No saved scenarios yet</div>
              <div className={`mt-1 ${planTheme.body}`}>
                Start with a “Higher Contributions” or “Conservative Return” scenario.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {winningScenarioInsight && (
                <div className={`${planTheme.innerPanel} border-accent/15`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className={planTheme.eyebrowAccent}>
                        <span className="inline-flex items-center gap-2">
                          <Sparkles size={13} />
                          Best current path
                        </span>
                      </div>

                      <div className="mt-3 text-[26px] sm:text-2xl font-display leading-[1.02] tracking-tight text-ink dark:text-white max-w-[18rem] sm:max-w-[32rem]">
                        {winningScenarioInsight.headline}
                      </div>

                      <div className={`mt-2 ${planTheme.body} max-w-[30rem]`}>
                        {winningScenarioInsight.subline}
                      </div>
                    </div>

                    <div
                      className={`hidden sm:flex items-center justify-center ${planTheme.innerCard} px-3 py-2 text-xs font-semibold text-ink dark:text-white shrink-0`}
                    >
                      {winningScenarioInsight.name}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className={planTheme.innerPanelCompact}>
                      <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                        <TrendingUp size={11} />
                        Projected
                      </div>
                      <div className="mt-2 font-display text-[28px] sm:text-xl leading-none text-ink dark:text-white">
                        {fmtCurrencyCompact(winningScenarioInsight.projected, ccy)}
                      </div>
                    </div>

                    <div className={planTheme.innerPanelCompact}>
                      <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                        <TrendingUp size={11} />
                        Vs plan
                      </div>
                      <div
                        className={`mt-2 font-display text-[28px] sm:text-xl leading-none ${
                          winningScenarioInsight.projectedDelta >= 0
                            ? 'text-gain dark:text-emerald-300'
                            : 'text-red-500 dark:text-red-300'
                        }`}
                      >
                        {winningScenarioInsight.projectedDelta >= 0 ? '+' : ''}
                        {fmtCurrencyCompact(winningScenarioInsight.projectedDelta, ccy)}
                      </div>
                    </div>

                    <div className={`${planTheme.innerPanelCompact} col-span-2 sm:col-span-1`}>
                      <div className={`${planTheme.statLabel} flex items-center gap-2`}>
                        <CalendarClock size={11} />
                        Freedom timing
                      </div>
                      <div className="mt-2 font-display text-[28px] sm:text-xl leading-none text-ink dark:text-white">
                        {winningScenarioInsight.freedomYear
                          ? winningScenarioInsight.freedomYear
                          : 'Off target'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5 sm:gap-4">
                {compareCards.map((card) => {
                  const scenario = scenarios.find((s) => s.id === card.id)
                  const isWinner = bestScenario?.id === card.id

                  return (
                    <div
                      key={card.id}
                      className={`${planTheme.innerPanel} ${planTheme.mobileInnerBleed} transition-all ${
                        isWinner
                          ? 'border-accent/20 shadow-[0_10px_30px_rgba(75,121,168,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.18)]'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-ink dark:text-white">
                              {card.name}
                            </div>
                            {isWinner && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold tracking-[.08em] uppercase bg-accent/10 text-accent dark:text-blue-300">
                                <Sparkles size={11} />
                                Best
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-xs text-ink-muted dark:text-white/35">
                            {fmtCurrency(card.monthlyContribution, ccy)}/mo • {card.expectedReturn}% return
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onEdit(scenario)}
                            className={planTheme.iconButton}
                            aria-label="Edit scenario"
                          >
                            <Pencil size={15} className="text-ink-muted dark:text-white/45" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDelete(card.id)}
                            className={planTheme.iconButton}
                            aria-label="Delete scenario"
                          >
                            <Trash2 size={15} className="text-ink-muted dark:text-white/45" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="text-xs text-ink-muted/50 dark:text-white/25 mb-1">
                          Projected at target age
                        </div>
                        <div className="font-display text-2xl text-ink dark:text-white tabular-nums">
                          {fmtCurrencyCompact(card.projected, ccy)}
                        </div>
                        <div
                          className={`mt-2 text-sm font-medium ${
                            card.projectedDelta >= 0
                              ? 'text-gain dark:text-emerald-300'
                              : 'text-red-500 dark:text-red-300'
                          }`}
                        >
                          {card.projectedDelta >= 0 ? '+' : ''}
                          {fmtCurrencyCompact(card.projectedDelta, ccy)} vs current plan
                        </div>
                      </div>

                      <div className={`mt-4 pt-4 border-t ${planTheme.divider} text-sm`}>
                        {card.freedomYear ? (
                          <div className="text-ink-muted dark:text-white/40">
                            Freedom year:{' '}
                            <span className="font-medium text-ink dark:text-white">
                              {card.freedomYear}
                            </span>
                            {card.freedomYearsEarlier > 0 && (
                              <span className="ml-2 text-gain dark:text-emerald-300">
                                ({card.freedomYearsEarlier}{' '}
                                {card.freedomYearsEarlier === 1 ? 'year' : 'years'} earlier)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-ink-muted dark:text-white/40">
                            Still off target at this pace
                          </div>
                        )}
                      </div>

                      {card.notes ? (
                        <div className="mt-3 text-xs text-ink-muted dark:text-white/30 leading-relaxed">
                          {card.notes}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}