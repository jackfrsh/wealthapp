/**
 * DrawdownPlannerCard
 *
 * Retirement Drawdown Planner — contained module inside Plan / Outlook.
 *
 * Answers four questions:
 *  1. How much could my pension provide per month?
 *  2. What happens if I take a lump sum first?
 *  3. How long might my pot last?
 *  4. How do 3%, 4%, and 5% drawdown rates compare?
 *
 * All outputs are illustrative only. Not financial advice.
 */

import React from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { fmtCurrency, fmtCurrencyCompact } from '../../utils'
import { planTheme } from './planTheme'
import PlanSectionFrame from './PlanSectionFrame'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function numFrom(v, fallback = 0) {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

function LongevityLabel({ age, targetEndAge, survives }) {
  if (survives) {
    return (
      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
        Beyond {targetEndAge}
      </span>
    )
  }
  if (age == null) return <span className="text-ink-muted dark:text-white/38">—</span>

  const yearsShort = targetEndAge - age
  const isClose = yearsShort <= 5

  return (
    <span
      className={
        isClose
          ? 'text-amber-600 dark:text-amber-400 font-semibold'
          : 'text-ink dark:text-white font-semibold'
      }
    >
      Age {age}
    </span>
  )
}

function LongevitySubtext({ age, targetEndAge, survives }) {
  if (survives) {
    return (
      <span className="text-emerald-600/70 dark:text-emerald-400/60 text-[11px]">
        Survives to {targetEndAge}
      </span>
    )
  }
  if (age == null) return null
  const yearsShort = targetEndAge - age
  if (yearsShort <= 0) return null
  return (
    <span className="text-[11px] text-ink-muted/60 dark:text-white/30">
      {yearsShort} yr{yearsShort !== 1 ? 's' : ''} before {targetEndAge}
    </span>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricTile({ label, value, sub }) {
  return (
    <div className={`${planTheme.innerPanel} flex flex-col gap-1`}>
      <div className={planTheme.eyebrow}>{label}</div>
      <div className="font-display text-[22px] leading-none tracking-tight text-ink dark:text-white">
        {value}
      </div>
      {sub && <div className="text-[11px] text-ink-muted/60 dark:text-white/30">{sub}</div>}
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div>
      <label className={planTheme.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, placeholder = '0', inputMode = 'decimal' }) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={planTheme.fieldInput}
    />
  )
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${planTheme.fieldInput} appearance-none cursor-pointer`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function PresetButtons({ options, current, onSelect }) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onSelect(String(o.value))}
          className="text-[11px] font-semibold px-2.5 py-2 rounded-xl border transition-colors"
          style={
            numFrom(current) === o.value
              ? {
                  background: 'rgba(var(--accent-rgb, 99,102,241), 0.12)',
                  borderColor: 'rgba(var(--accent-rgb, 99,102,241), 0.35)',
                  color: 'var(--accent)',
                }
              : {
                  background: 'transparent',
                  borderColor: 'rgba(0,0,0,0.08)',
                  color: 'var(--text-muted)',
                }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ResultSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`${planTheme.innerPanel} space-y-2`}
        >
          <div className="h-2 w-16 rounded-full bg-black/[.06] dark:bg-white/[.06]" />
          <div className="h-6 w-24 rounded-lg bg-black/[.06] dark:bg-white/[.06]" />
        </div>
      ))}
    </div>
  )
}

// ─── Comparison table ─────────────────────────────────────────────────────────

function ComparisonTable({ comparison, ccy, showRealTerms, targetEndAge }) {
  if (!comparison?.length) return null

  return (
    <div>
      <div className={`mb-3 flex items-center gap-2`}>
        <div className={planTheme.eyebrow}>Drawdown comparison</div>
        <div className="text-[10px] text-ink-muted/50 dark:text-white/25 font-medium">
          Comparison assumptions only
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {comparison.map((row) => {
          const monthly = showRealTerms
            ? row.monthly_income_real
            : row.monthly_income_nominal
          const annual = showRealTerms
            ? row.annual_income_real
            : row.annual_income_nominal

          return (
            <div key={row.rate_pct} className={planTheme.innerCard}>
              <div className="px-4 pt-4 pb-1">
                <div className="text-[11px] font-semibold tracking-[.12em] uppercase text-ink-muted/60 dark:text-white/30">
                  {row.rate_pct}% drawdown
                </div>
              </div>
              <div className="px-4 pb-4 space-y-3 mt-2">
                <div>
                  <div className="text-[10px] text-ink-muted/50 dark:text-white/25 uppercase tracking-[.14em] mb-0.5">
                    Monthly
                  </div>
                  <div className="font-display text-[18px] leading-tight tracking-tight text-ink dark:text-white">
                    {fmtCurrency(monthly, ccy)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-muted/50 dark:text-white/25 uppercase tracking-[.14em] mb-0.5">
                    Annual
                  </div>
                  <div className="text-[14px] font-semibold text-ink dark:text-white">
                    {fmtCurrencyCompact(annual, ccy)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-muted/50 dark:text-white/25 uppercase tracking-[.14em] mb-0.5">
                    Pot lasts until
                  </div>
                  <div className="text-[13px]">
                    <LongevityLabel
                      age={row.pot_lasts_until_age}
                      targetEndAge={targetEndAge}
                      survives={row.survives_to_target_age}
                    />
                  </div>
                  <div className="mt-0.5">
                    <LongevitySubtext
                      age={row.pot_lasts_until_age}
                      targetEndAge={targetEndAge}
                      survives={row.survives_to_target_age}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[11px] text-ink-muted/50 dark:text-white/25 leading-relaxed">
        Comparison rates are illustrative only. 4% is not a recommended withdrawal rate.
        These figures assume a constant nominal withdrawal from the remaining pot after any
        lump sum.
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DrawdownPlannerCard({
  ccy,
  drawdown,
  isOpen,
  onToggleOpen,
}) {
  const {
    inputs,
    setInput,
    result,
    loading,
    error,
    showAssumptions,
    setShowAssumptions,
    showRealTerms,
    setShowRealTerms,
    isValid,
  } = drawdown

  const retAge = numFrom(inputs.retirement_age, 65)
  const targetEndAge = numFrom(inputs.target_end_age, 95)
  const potEntered = String(inputs.current_pot ?? '').trim() !== ''

  const monthly = result
    ? showRealTerms
      ? result.monthly_income_real
      : result.monthly_income_nominal
    : null
  const annual = result
    ? showRealTerms
      ? result.annual_income_real
      : result.annual_income_nominal
    : null

  const header = (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h3 className={planTheme.title}>Retirement Drawdown Planner</h3>
        </div>
        <div className={`mt-1 ${planTheme.body} text-xs`}>
          {result
            ? `Estimated ${fmtCurrency(result.monthly_income_nominal, ccy)}/mo at retirement`
            : 'Model your pension income and longevity'}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleOpen}
        className={`${planTheme.iconButton} shrink-0`}
        aria-label={isOpen ? 'Collapse planner' : 'Expand planner'}
      >
        {isOpen ? (
          <ChevronUp size={16} className="text-ink-muted dark:text-white/40" />
        ) : (
          <ChevronDown size={16} className="text-ink-muted dark:text-white/40" />
        )}
      </button>
    </div>
  )

  return (
    <PlanSectionFrame header={header}>
      {isOpen && (
        <div className="space-y-6">

          {/* ── Overview metrics ── */}
          {loading && !result && <ResultSkeleton />}

          {!loading && !potEntered && !result && (
            <div className="rounded-2xl border border-dashed border-black/[.08] dark:border-white/[.08] px-5 py-6 text-center">
              <div className="text-sm font-semibold text-ink dark:text-white mb-1">
                Enter your pension pot to get started
              </div>
              <div className="text-xs text-ink-muted/60 dark:text-white/30">
                Add the current value of your pension(s) below and adjust the assumptions
                to model your retirement income.
              </div>
            </div>
          )}

          {result && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricTile
                  label="Pot at retirement"
                  value={fmtCurrencyCompact(result.projected_pot_at_retirement, ccy)}
                  sub={`At age ${retAge}`}
                />
                <MetricTile
                  label={showRealTerms ? "Monthly income (today's £)" : 'Estimated monthly'}
                  value={monthly != null ? fmtCurrency(monthly, ccy) : '—'}
                  sub={annual != null ? `${fmtCurrencyCompact(annual, ccy)}/yr` : undefined}
                />
                <MetricTile
                  label="Pot lasts until"
                  value={
                    <LongevityLabel
                      age={result.pot_lasts_until_age}
                      targetEndAge={targetEndAge}
                      survives={result.survives_to_target_age}
                    />
                  }
                  sub={
                    <LongevitySubtext
                      age={result.pot_lasts_until_age}
                      targetEndAge={targetEndAge}
                      survives={result.survives_to_target_age}
                    />
                  }
                />
                <MetricTile
                  label="Lump sum"
                  value={
                    result.lump_sum_applied > 0
                      ? fmtCurrencyCompact(result.lump_sum_applied, ccy)
                      : '—'
                  }
                  sub={result.lump_sum_applied > 0 ? 'Applied at retirement' : 'None configured'}
                />
              </div>

              {/* Real-terms toggle */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRealTerms((v) => !v)}
                  className={[
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                    showRealTerms
                      ? 'bg-accent'
                      : 'bg-black/[.10] dark:bg-white/[.12]',
                  ].join(' ')}
                  role="switch"
                  aria-checked={showRealTerms}
                >
                  <span
                    className={[
                      'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                      showRealTerms ? 'translate-x-[18px]' : 'translate-x-[3px]',
                    ].join(' ')}
                  />
                </button>
                <span className="text-xs text-ink-muted dark:text-white/40">
                  {showRealTerms
                    ? `Today's money (deflated at ${numFrom(inputs.inflation_rate_pct, 2.5)}% inflation)`
                    : 'Show in today\'s money'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-500/[.08] border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
              <Info size={13} className="shrink-0 mt-0.5" />
              <span>Check your inputs — {error}</span>
            </div>
          )}

          {/* ── Assumptions ── */}
          <div>
            <button
              type="button"
              onClick={() => setShowAssumptions((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-ink-muted dark:text-white/40 hover:text-ink dark:hover:text-white/70 transition-colors"
            >
              {showAssumptions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showAssumptions ? 'Hide assumptions' : 'Edit assumptions'}
            </button>

            {showAssumptions && (
              <div className="mt-4 space-y-5">
                {/* Row 1: Pot + ages */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldRow label={`Pension pot (${ccy})`}>
                    <NumInput
                      value={inputs.current_pot}
                      onChange={(v) => setInput('current_pot', v)}
                      placeholder="e.g. 80000"
                    />
                  </FieldRow>
                  <FieldRow label="Current age">
                    <NumInput
                      value={inputs.current_age}
                      onChange={(v) => setInput('current_age', v)}
                      placeholder="40"
                      inputMode="numeric"
                    />
                  </FieldRow>
                  <FieldRow label="Retirement age">
                    <NumInput
                      value={inputs.retirement_age}
                      onChange={(v) => setInput('retirement_age', v)}
                      placeholder="65"
                      inputMode="numeric"
                    />
                  </FieldRow>
                </div>

                {/* Row 2: Monthly contribution + return + fees */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldRow label={`Monthly contribution (${ccy})`}>
                    <NumInput
                      value={inputs.monthly_contribution}
                      onChange={(v) => setInput('monthly_contribution', v)}
                      placeholder="500"
                    />
                  </FieldRow>
                  <FieldRow label="Annual return (%)">
                    <div className="space-y-2">
                      <NumInput
                        value={inputs.annual_return_pct}
                        onChange={(v) => setInput('annual_return_pct', v)}
                        placeholder="7"
                      />
                      <PresetButtons
                        options={[
                          { label: '4%', value: 4 },
                          { label: '6%', value: 6 },
                          { label: '8%', value: 8 },
                        ]}
                        current={inputs.annual_return_pct}
                        onSelect={(v) => setInput('annual_return_pct', v)}
                      />
                    </div>
                  </FieldRow>
                  <FieldRow label="Annual fee (%)">
                    <div className="space-y-2">
                      <NumInput
                        value={inputs.annual_fee_pct}
                        onChange={(v) => setInput('annual_fee_pct', v)}
                        placeholder="0.75"
                      />
                      <PresetButtons
                        options={[
                          { label: '0.25%', value: 0.25 },
                          { label: '0.75%', value: 0.75 },
                          { label: '1.5%', value: 1.5 },
                        ]}
                        current={inputs.annual_fee_pct}
                        onSelect={(v) => setInput('annual_fee_pct', v)}
                      />
                    </div>
                  </FieldRow>
                </div>

                {/* Row 3: Inflation + target end age + withdrawal mode */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldRow label="Inflation rate (%)">
                    <NumInput
                      value={inputs.inflation_rate_pct}
                      onChange={(v) => setInput('inflation_rate_pct', v)}
                      placeholder="2.5"
                    />
                  </FieldRow>
                  <FieldRow label="Target end age">
                    <NumInput
                      value={inputs.target_end_age}
                      onChange={(v) => setInput('target_end_age', v)}
                      placeholder="95"
                      inputMode="numeric"
                    />
                  </FieldRow>
                  <FieldRow label="Withdrawal mode">
                    <SelectInput
                      value={inputs.withdrawal_mode}
                      onChange={(v) => setInput('withdrawal_mode', v)}
                      options={[
                        { value: 'percentage', label: 'Percentage of pot' },
                        { value: 'fixed_monthly', label: 'Fixed monthly amount' },
                      ]}
                    />
                  </FieldRow>
                </div>

                {/* Withdrawal value — contextual label */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldRow
                    label={
                      inputs.withdrawal_mode === 'percentage'
                        ? 'Withdrawal rate (%)'
                        : `Monthly withdrawal (${ccy})`
                    }
                  >
                    <div className="space-y-2">
                      <NumInput
                        value={inputs.withdrawal_value}
                        onChange={(v) => setInput('withdrawal_value', v)}
                        placeholder={inputs.withdrawal_mode === 'percentage' ? '4' : '2000'}
                      />
                      {inputs.withdrawal_mode === 'percentage' && (
                        <PresetButtons
                          options={[
                            { label: '3%', value: 3 },
                            { label: '4%', value: 4 },
                            { label: '5%', value: 5 },
                          ]}
                          current={inputs.withdrawal_value}
                          onSelect={(v) => setInput('withdrawal_value', v)}
                        />
                      )}
                    </div>
                  </FieldRow>

                  {/* Lump sum type */}
                  <FieldRow label="Lump sum at retirement">
                    <SelectInput
                      value={inputs.lump_sum_type}
                      onChange={(v) => setInput('lump_sum_type', v)}
                      options={[
                        { value: 'none', label: 'None' },
                        { value: 'amount', label: 'Fixed amount' },
                        { value: 'percentage', label: 'Percentage of pot' },
                      ]}
                    />
                  </FieldRow>

                  {/* Lump sum value — only when type != none */}
                  {inputs.lump_sum_type !== 'none' && (
                    <FieldRow
                      label={
                        inputs.lump_sum_type === 'percentage'
                          ? 'Lump sum (%)'
                          : `Lump sum (${ccy})`
                      }
                    >
                      <NumInput
                        value={inputs.lump_sum_value}
                        onChange={(v) => setInput('lump_sum_value', v)}
                        placeholder={inputs.lump_sum_type === 'percentage' ? '25' : '50000'}
                      />
                    </FieldRow>
                  )}
                </div>

                <p className="text-[11px] text-ink-muted/50 dark:text-white/25 leading-relaxed">
                  Compounding is monthly. Return and fee rates are applied geometrically.
                  Withdrawal is a constant nominal amount (initial-pot method).
                  {showRealTerms &&
                    ` Real-terms figures deflate by ${numFrom(inputs.inflation_rate_pct, 2.5)}% per year.`}
                </p>
              </div>
            )}
          </div>

          {/* ── Drawdown comparison ── */}
          {result && (
            <ComparisonTable
              comparison={result.comparison}
              ccy={ccy}
              showRealTerms={showRealTerms}
              targetEndAge={targetEndAge}
            />
          )}

          {/* ── Longevity note ── */}
          {result && !result.survives_to_target_age && result.pot_lasts_until_age != null && (
            <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-2xl bg-black/[.03] dark:bg-white/[.04] border border-black/[.05] dark:border-white/[.06]">
              <Info size={13} className="shrink-0 mt-0.5 text-ink-muted/60 dark:text-white/30" />
              <p className="text-xs text-ink-muted dark:text-white/40 leading-relaxed">
                At this rate, the pot may not last to age {targetEndAge}.{' '}
                {result.pot_lasts_until_age < retAge + 5
                  ? 'Higher contributions, a lower withdrawal rate, or a later retirement age could extend longevity.'
                  : 'A lower withdrawal rate or higher contributions may extend longevity.'}
              </p>
            </div>
          )}

          {/* ── Footer disclaimer ── */}
          <p className="text-[11px] text-ink-muted/40 dark:text-white/20 leading-relaxed border-t border-black/[.05] dark:border-white/[.05] pt-4">
            Illustrative only. Based on your assumptions. Not financial advice. Returns,
            fees, and inflation may vary. Pot longevity assumes a constant nominal withdrawal
            from the remaining invested pot.
          </p>
        </div>
      )}
    </PlanSectionFrame>
  )
}
