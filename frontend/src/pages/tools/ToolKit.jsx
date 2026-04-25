import React from 'react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { fmtCurrency } from '../../utils'

export function formatCurrency(value, currency = 'GBP') {
  return fmtCurrency(Number.isFinite(Number(value)) ? Number(value) : 0, currency)
}

export function ToolIntro({ kicker, title, children }) {
  return (
    <div>
      <div className="guide-kicker">{kicker}</div>
      <h1 className="guide-h1">{title}</h1>
      <p className="guide-lead">{children}</p>
      <p className="mt-[-1.5rem] max-w-[62ch] text-xs leading-6 text-ink-muted/70 dark:text-white/32">
        Manual, private wealth tracking. No bank connection required. Tool inputs stay in your browser.
      </p>
    </div>
  )
}

export function Field({ label, value, onChange, prefix, suffix, hint, min, max, step = 'any' }) {
  return (
    <label className="block min-w-0">
      <div className="mb-2 text-sm font-semibold leading-5 text-ink/80 dark:text-white/72">
        {label}
      </div>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted/70 dark:text-white/40">
            {prefix}
          </span>
        ) : null}
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={[
            'min-w-0 w-full rounded-2xl border border-black/[.08] bg-white/80 px-4 py-3.5 text-base text-ink outline-none transition-colors',
            'focus:border-accent/40 focus:ring-4 focus:ring-accent/10',
            'dark:border-white/[.08] dark:bg-white/[.03] dark:text-white dark:focus:border-accent/40',
            prefix ? 'pl-9' : '',
            suffix ? 'pr-16' : '',
          ].join(' ')}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted/70 dark:text-white/40">
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-2 text-xs leading-5 text-ink-muted/70 dark:text-white/35">{hint}</div> : null}
    </label>
  )
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block min-w-0">
      <div className="mb-2 text-sm font-semibold leading-5 text-ink/80 dark:text-white/72">
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 w-full rounded-2xl border border-black/[.08] bg-white/80 px-4 py-3.5 text-base text-ink outline-none transition-colors focus:border-accent/40 focus:ring-4 focus:ring-accent/10 dark:border-white/[.08] dark:bg-white/[.03] dark:text-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="grid grid-cols-2 rounded-2xl border border-black/[.08] bg-black/[.03] p-1 dark:border-white/[.08] dark:bg-white/[.04]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={[
            'rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
            value === option.value
              ? 'bg-white text-ink shadow-card dark:bg-white/[.10] dark:text-white'
              : 'text-ink-muted/75 hover:text-ink dark:text-white/40 dark:hover:text-white',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function FormSection({ title, children, columns = 2 }) {
  return (
    <div className="space-y-4 border-b border-black/[.06] pb-7 last:border-b-0 last:pb-0 dark:border-white/[.07]">
      <div className="text-[13px] font-semibold text-ink dark:text-white">
        {title}
      </div>
      <div className={`grid gap-5 ${columns === 1 ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
        {children}
      </div>
    </div>
  )
}

export function Stat({ label, value, note, highlight = false }) {
  return (
    <Card pad="lg" className={highlight ? 'bg-gradient-to-br from-white to-slate-50/80 dark:from-white/[0.055] dark:to-white/[0.02]' : ''}>
      <div className="tool-stat-value font-display text-[2rem] leading-none text-ink dark:text-white">
        {value}
      </div>
      <div className="mt-3 text-xs font-semibold text-ink-muted/70 dark:text-white/38">
        {label}
      </div>
      {note ? <p className="mt-2 text-xs leading-5 text-ink-muted/75 dark:text-white/38">{note}</p> : null}
    </Card>
  )
}

export function Errors({ errors }) {
  if (!errors?.length) return null
  return (
    <div className="rounded-2xl border border-negative/20 bg-negative-soft/70 p-4 text-sm leading-6 text-negative dark:bg-negative-soft">
      {errors.map((error) => (
        <div key={error}>{error}</div>
      ))}
    </div>
  )
}

export function ProgressBar({ value }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-muted/70 dark:text-white/35">
        <span>Progress</span>
        <span>{clamped.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]">
        <div className="h-full rounded-full bg-accent" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

export function ToolCTA({ children, onClick, buttonText = 'Continue this plan in Paddock' }) {
  return (
    <Card pad="lg" className="bg-gradient-to-br from-white to-slate-50/80 dark:from-white/[0.04] dark:to-white/[0.02]">
      <p className="text-sm leading-7 text-ink-muted/90 dark:text-white/50">{children}</p>
      <Button className="mt-4 w-full sm:w-auto" onClick={onClick}>
        {buttonText}
      </Button>
      <p className="mt-3 text-xs leading-5 text-ink-muted/65 dark:text-white/30">
        Manual, private wealth tracking. No bank connection required.
      </p>
    </Card>
  )
}
