import React, { useEffect, useState } from 'react'
import Card from '../../components/Card'
import { PublicShell } from '../../components/GuideLayout'
import { useSEO } from '../../useSEO'
import { usePublicNavigation } from '../public/navigation'
import { calculateIsa } from './calculations'
import { Errors, Field, FormSection, formatCurrency, ProgressBar, Stat, ToolCTA, ToolIntro } from './ToolKit'

const DEFAULTS = {
  initialAmount: '10000',
  monthlyContribution: '500',
  years: '20',
  annualReturn: '5',
  annualFee: '0.15',
  targetValue: '',
}

export default function IsaGrowthCalculator() {
  const { navigateTo, openPaddock } = usePublicNavigation()
  const [form, setForm] = useState(DEFAULTS)
  const [result, setResult] = useState(() => calculateIsa(DEFAULTS))

  useSEO({
    title: 'ISA Growth Calculator UK — Paddock',
    description:
      'Free ISA growth calculator. Project your Stocks and Shares ISA balance with monthly contributions and fees.',
    canonicalPath: '/tools/isa-growth-calculator',
  })

  useEffect(() => {
    setResult(calculateIsa(form))
  }, [form])

  const setField = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))

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
          <ToolIntro kicker="ISA planning tool" title="ISA Growth Calculator UK">
            Project how a Stocks and Shares ISA could grow over time, including contributions,
            platform fees, and a 3% / 5% / 7% return comparison.
          </ToolIntro>

          <Card className="mt-8" pad="lg">
            <div className="space-y-6">
              <FormSection title="Your ISA">
                <Field label="Current ISA balance" prefix="£" value={form.initialAmount} onChange={setField('initialAmount')} min="0" />
                <Field label="Monthly contribution" prefix="£" value={form.monthlyContribution} onChange={setField('monthlyContribution')} min="0" />
              </FormSection>
              <FormSection title="Assumptions">
                <Field label="Years to grow" suffix="years" value={form.years} onChange={setField('years')} min="1" max="50" step="1" />
                <Field label="Annual return" suffix="%" value={form.annualReturn} onChange={setField('annualReturn')} min="0" max="20" />
                <Field label="Annual platform fee" suffix="%" value={form.annualFee} onChange={setField('annualFee')} min="0" max="5" />
                <Field label="Target ISA value" prefix="£" value={form.targetValue} onChange={setField('targetValue')} min="1" hint="Optional." />
              </FormSection>
              <Errors errors={result.ok ? [] : result.errors} />
            </div>
          </Card>
        </div>

        <div className="public-tool-results space-y-4">
          {result.ok ? (
            <>
              <Stat label="Projected value" value={formatCurrency(result.projectedValue)} note={`After ${form.years} years`} highlight />
              <Stat label="Total contributed" value={formatCurrency(result.totalContributed)} />
              <Stat label="Investment growth" value={formatCurrency(result.totalGrowth)} />
              {result.targetProgressPct !== null ? (
                <Card pad="lg">
                  <ProgressBar value={result.targetProgressPct} />
                </Card>
              ) : null}
              <Card pad="lg">
                <div className="text-xs font-semibold text-ink-muted/70 dark:text-white/38">
                  Return comparison
                </div>
                <div className="mt-4 space-y-3">
                  {result.comparison.map((row) => (
                    <div key={row.rateLabel} className="tool-comparison-row rounded-2xl border border-black/[.06] p-3 text-sm dark:border-white/[.07]">
                      <div className="font-semibold text-ink dark:text-white">{row.rateLabel}</div>
                      <div className="text-ink-muted/80 dark:text-white/45">{formatCurrency(row.projectedValue)}</div>
                      <div className="text-right text-xs text-ink-muted/70 dark:text-white/35">{formatCurrency(row.totalGrowth)} growth</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card pad="lg">
              <p className="text-sm leading-7 text-ink-muted/80 dark:text-white/45">
                Adjust the inputs to see your ISA projection.
              </p>
            </Card>
          )}
          <ToolCTA onClick={openPaddock}>Track your ISA alongside pensions, savings, and investments with Paddock.</ToolCTA>
          <p className="text-xs leading-6 text-ink-muted/70 dark:text-white/32">
            Illustrative only. ISA allowance rules and tax treatment may change. This is not financial advice.
          </p>
        </div>
      </div>
    </PublicShell>
  )
}
