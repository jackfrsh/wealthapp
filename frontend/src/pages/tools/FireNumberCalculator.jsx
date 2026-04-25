import React, { useEffect, useState } from 'react'
import Card from '../../components/Card'
import { PublicShell } from '../../components/GuideLayout'
import { useSEO } from '../../useSEO'
import { usePublicNavigation } from '../public/navigation'
import { calculateFire } from './calculations'
import { Errors, Field, FormSection, formatCurrency, ProgressBar, Stat, ToolCTA, ToolIntro } from './ToolKit'

const DEFAULTS = {
  annualSpending: '30000',
  passiveIncome: '0',
  withdrawalRate: '4',
  currentAssets: '100000',
  annualContributions: '12000',
  annualReturn: '5',
}

function yearsLabel(years) {
  if (years === null) return 'No estimate'
  if (years === 0) return 'Reached'
  return `~${years} year${years === 1 ? '' : 's'}`
}

export default function FireNumberCalculator() {
  const { navigateTo, openPaddock } = usePublicNavigation()
  const [form, setForm] = useState(DEFAULTS)
  const [result, setResult] = useState(() => calculateFire(DEFAULTS))

  useSEO({
    title: 'FIRE Number Calculator UK — Paddock',
    description:
      'Free FIRE number calculator. Estimate your financial independence target, progress, and timeline.',
    canonicalPath: '/tools/fire-number-calculator',
  })

  useEffect(() => {
    setResult(calculateFire(form))
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
          <ToolIntro kicker="Financial independence tool" title="FIRE Number Calculator UK">
            Estimate the portfolio you may need for financial independence, how far away you are,
            and how sensitive the target is to different withdrawal rates.
          </ToolIntro>

          <Card className="mt-8" pad="lg">
            <div className="space-y-6">
              <FormSection title="Your spending">
                <Field label="Annual spending" prefix="£" value={form.annualSpending} onChange={setField('annualSpending')} min="0" />
                <Field label="Other passive income" prefix="£" value={form.passiveIncome} onChange={setField('passiveIncome')} min="0" hint="Rental income, defined benefit pension, or similar." />
              </FormSection>
              <FormSection title="Portfolio">
                <Field label="Current invested assets" prefix="£" value={form.currentAssets} onChange={setField('currentAssets')} min="0" />
                <Field label="Annual contributions" prefix="£" value={form.annualContributions} onChange={setField('annualContributions')} min="0" />
              </FormSection>
              <FormSection title="Assumptions">
                <Field label="Withdrawal rate" suffix="%" value={form.withdrawalRate} onChange={setField('withdrawalRate')} min="0.5" max="20" />
                <Field label="Expected annual return" suffix="%" value={form.annualReturn} onChange={setField('annualReturn')} min="0" max="20" />
              </FormSection>
              <Errors errors={result.ok ? [] : result.errors} />
            </div>
          </Card>
        </div>

        <div className="public-tool-results space-y-4">
          {result.ok ? (
            <>
              <Stat label="FIRE number" value={formatCurrency(result.fireNumber)} note={`At a ${form.withdrawalRate}% withdrawal rate`} highlight />
              <Stat label="Current portfolio" value={formatCurrency(result.currentAssets)} note={result.gap > 0 ? `${formatCurrency(result.gap)} gap remaining` : 'Target met'} />
              <Stat label="Estimated time to FI" value={yearsLabel(result.yearsToFI)} note="Simple annual compounding estimate" />
              <Card pad="lg">
                <ProgressBar value={result.progressPct} />
              </Card>
              <Card pad="lg">
                <div className="text-xs font-semibold text-ink-muted/70 dark:text-white/38">
                  Withdrawal rate comparison
                </div>
                <div className="mt-4 space-y-3">
                  {result.comparison.map((row) => (
                    <div key={row.rateLabel} className="tool-comparison-row rounded-2xl border border-black/[.06] p-3 text-sm dark:border-white/[.07]">
                      <div className="font-semibold text-ink dark:text-white">{row.rateLabel}</div>
                      <div className="text-ink-muted/80 dark:text-white/45">{formatCurrency(row.fireNumber)}</div>
                      <div className="text-right text-xs text-ink-muted/70 dark:text-white/35">{yearsLabel(row.yearsToFI)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <Card pad="lg">
              <p className="text-sm leading-7 text-ink-muted/80 dark:text-white/45">
                Adjust the inputs to see your estimate.
              </p>
            </Card>
          )}
          <ToolCTA onClick={openPaddock}>Save your FIRE target and track your progress with Paddock.</ToolCTA>
          <p className="text-xs leading-6 text-ink-muted/70 dark:text-white/32">
            Illustrative only. This tool is not financial advice.
          </p>
        </div>
      </div>
    </PublicShell>
  )
}
