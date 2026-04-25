import React, { useEffect, useState } from 'react'
import Card from '../../components/Card'
import { PublicShell } from '../../components/GuideLayout'
import { useSEO } from '../../useSEO'
import { usePublicNavigation } from '../public/navigation'
import { calculateDrawdown, parseMoney } from './calculations'
import {
  Errors,
  Field,
  FormSection,
  formatCurrency,
  Segmented,
  Stat,
  ToolCTA,
  ToolIntro,
} from './ToolKit'

const DEFAULTS = {
  pot: '100000',
  currentAge: '45',
  retirementAge: '65',
  targetEndAge: '90',
  monthlyContribution: '500',
  annualReturn: '5',
  annualFee: '0.5',
  lumpSum: '0',
  withdrawalMode: 'percentage',
  annualWithdrawalPct: '4',
  fixedMonthlyAmount: '1500',
}

function Longevity({ result, targetEndAge }) {
  const survives = result.exhaustedAge === null
  return (
    <Card pad="lg">
      <div className="text-xs font-semibold text-ink-muted/70 dark:text-white/38">
        Longevity estimate
      </div>
      <div className="mt-3 font-display text-[2rem] leading-none text-ink dark:text-white">
        {survives ? `Beyond age ${targetEndAge}` : `Age ${result.exhaustedAge}`}
      </div>
      <p className="mt-3 text-sm leading-7 text-ink-muted/80 dark:text-white/45">
        {survives
          ? `The pot still has ${formatCurrency(result.potAtTargetAge)} remaining at your target end age.`
          : `On these assumptions, the pot runs down before age ${targetEndAge}.`}
      </p>
    </Card>
  )
}

function durationLabel(result, retirementAge, targetEndAge) {
  if (result.exhaustedAge === null) return `${Math.max(0, targetEndAge - retirementAge).toFixed(0)}+ years`
  const years = Math.max(0, result.exhaustedAge - retirementAge)
  return `${years.toFixed(years >= 10 ? 0 : 1)} years`
}

function interpretation(result, retirementAge, targetEndAge) {
  if (result.exhaustedAge === null) {
    return `At this rate, your pension could last beyond age ${targetEndAge}, with ${formatCurrency(result.potAtTargetAge)} still projected at that point.`
  }

  const years = Math.max(0, result.exhaustedAge - retirementAge)
  return `At this rate, your pension could last approximately ${years.toFixed(years >= 10 ? 0 : 1)} years, from age ${retirementAge} to around age ${result.exhaustedAge}.`
}

export default function PensionDrawdownCalculator() {
  const { navigateTo, openPaddock } = usePublicNavigation()
  const [form, setForm] = useState(DEFAULTS)
  const [result, setResult] = useState(() => calculateDrawdown(DEFAULTS))

  useSEO({
    title: 'Pension Drawdown Calculator UK — Paddock',
    description:
      'Free UK pension drawdown calculator. Project your pension pot at retirement and estimate how long it may last.',
    canonicalPath: '/tools/pension-drawdown-calculator',
  })

  useEffect(() => {
    setResult(calculateDrawdown(form))
  }, [form])

  const setField = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))
  const targetEndAge = parseMoney(form.targetEndAge)
  const retirementAge = parseMoney(form.retirementAge)

  return (
    <PublicShell
      title="Tool"
      onBack={() => navigateTo('/tools')}
      navigateTo={navigateTo}
      backLabel="Back to Tools"
      layout="tool"
    >
      <div className="public-tool-layout">
        <div>
          <ToolIntro kicker="Pension planning tool" title="Pension Drawdown Calculator UK">
            Enter your pension pot, retirement age, and drawdown assumptions to see how far your
            pension could go, including a 3% / 4% / 5% withdrawal comparison.
          </ToolIntro>

          <Card className="mt-8" pad="lg">
            <div className="space-y-7">
              <FormSection title="Your pension">
                <Field label="Current pension pot" prefix="£" value={form.pot} onChange={setField('pot')} min="0" />
                <Field label="Monthly contribution" prefix="£" value={form.monthlyContribution} onChange={setField('monthlyContribution')} min="0" />
                <Field label="Current age" value={form.currentAge} onChange={setField('currentAge')} min="18" max="80" step="1" />
                <Field label="Retirement age" value={form.retirementAge} onChange={setField('retirementAge')} min="18" max="90" step="1" />
              </FormSection>

              <FormSection title="Growth assumptions">
                <Field label="Expected annual return" suffix="%" value={form.annualReturn} onChange={setField('annualReturn')} min="0" max="20" />
                <Field label="Annual fee" suffix="%" value={form.annualFee} onChange={setField('annualFee')} min="0" max="5" />
                <Field label="Target end age" value={form.targetEndAge} onChange={setField('targetEndAge')} min="50" max="100" step="1" />
                <Field label="Lump sum at retirement" prefix="£" value={form.lumpSum} onChange={setField('lumpSum')} min="0" />
              </FormSection>

              <FormSection title="Drawdown" columns={1}>
                <Segmented
                  value={form.withdrawalMode}
                  onChange={setField('withdrawalMode')}
                  options={[
                    { value: 'percentage', label: '% of pot' },
                    { value: 'fixed', label: 'Fixed monthly' },
                  ]}
                />
                {form.withdrawalMode === 'percentage' ? (
                  <Field label="Annual withdrawal rate" suffix="%" value={form.annualWithdrawalPct} onChange={setField('annualWithdrawalPct')} min="0" max="20" />
                ) : (
                  <Field label="Fixed monthly withdrawal" prefix="£" value={form.fixedMonthlyAmount} onChange={setField('fixedMonthlyAmount')} min="0" />
                )}
              </FormSection>

              <Errors errors={result.ok ? [] : result.errors} />
            </div>
          </Card>
        </div>

        <div className="public-tool-results space-y-4">
          {result.ok ? (
            <>
              <Stat
                label="Estimated drawdown duration"
                value={durationLabel(result, retirementAge, targetEndAge)}
                note={result.exhaustedAge === null ? `Modelled from age ${retirementAge} to ${targetEndAge}` : `Modelled from age ${retirementAge}`}
                highlight
              />
              <Card pad="lg">
                <div className="text-xs font-semibold text-ink-muted/70 dark:text-white/38">
                  Plain-English result
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-muted/90 dark:text-white/50">
                  {interpretation(result, retirementAge, targetEndAge)}
                </p>
              </Card>
              <Stat label="Projected pot at retirement" value={formatCurrency(result.potAtRetirement)} />
              <Stat label="Starting monthly income" value={formatCurrency(result.monthlyIncome)} note={`${formatCurrency(result.annualIncome)} per year`} />
              {result.lumpSumApplied > 0 ? (
                <Stat label="Available for drawdown" value={formatCurrency(result.potAfterLumpSum)} note={`After ${formatCurrency(result.lumpSumApplied)} lump sum`} />
              ) : null}
              <Longevity result={result} targetEndAge={targetEndAge} />
              <Card pad="lg">
                <div className="text-xs font-semibold text-ink-muted/70 dark:text-white/38">
                  Scenario check
                </div>
                <div className="mt-4 space-y-3">
                  {result.comparison.map((row) => (
                    <div key={row.rateLabel} className="tool-comparison-row rounded-2xl border border-black/[.06] p-3 text-sm dark:border-white/[.07]">
                      <div className="font-semibold text-ink dark:text-white">{row.rateLabel}</div>
                      <div className="text-ink-muted/80 dark:text-white/45">
                        {formatCurrency(row.monthlyIncome)}/mo
                      </div>
                      <div className="text-right text-xs text-ink-muted/70 dark:text-white/35">
                        {row.exhaustedAge ? `age ${row.exhaustedAge}` : `beyond ${targetEndAge}`}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card pad="lg">
              <p className="text-sm leading-7 text-ink-muted/80 dark:text-white/45">
                Adjust the inputs to see your projection.
              </p>
            </Card>
          )}

          <ToolCTA onClick={openPaddock} buttonText="Save this projection and track it over time">
            Save this projection and compare it with your real pension updates over time.
          </ToolCTA>
          <p className="text-xs leading-6 text-ink-muted/70 dark:text-white/32">
            This tool is for education and planning only. It is not financial advice.
          </p>
        </div>
      </div>
    </PublicShell>
  )
}
