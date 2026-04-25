import React, { useMemo, useState } from 'react'
import Card from '../../components/Card'
import { PublicShell } from '../../components/GuideLayout'
import { useSEO } from '../../useSEO'
import { usePublicNavigation } from '../public/navigation'
import {
  ASSET_ROWS,
  calculateNetWorth,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  LIABILITY_ROWS,
} from './calculations'
import { formatCurrency, SelectField, Stat, ToolCTA, ToolIntro } from './ToolKit'

function makeRows(currency) {
  return [...ASSET_ROWS, ...LIABILITY_ROWS].reduce((acc, row) => {
    acc[row.key] = { amount: '', currency }
    return acc
  }, {})
}

function EntryRow({ row, value, onChange, showCurrency }) {
  const symbol = CURRENCY_SYMBOLS[value.currency] || '£'
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(150px,0.85fr)_minmax(190px,1fr)_minmax(96px,120px)] md:items-center">
      <div className="text-sm font-semibold text-ink dark:text-white">{row.label}</div>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted/70 dark:text-white/40">
          {symbol}
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={value.amount}
          onChange={(event) => onChange(row.key, 'amount', event.target.value)}
          className="min-w-0 w-full rounded-2xl border border-black/[.08] bg-white/80 py-3 pl-9 pr-4 text-base text-ink outline-none transition-colors focus:border-accent/40 focus:ring-4 focus:ring-accent/10 dark:border-white/[.08] dark:bg-white/[.03] dark:text-white"
        />
      </div>
      {showCurrency ? (
        <select
          value={value.currency}
          onChange={(event) => onChange(row.key, 'currency', event.target.value)}
          className="min-w-0 w-full rounded-2xl border border-black/[.08] bg-white/80 px-3 py-3 text-sm text-ink outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/10 dark:border-white/[.08] dark:bg-white/[.03] dark:text-white"
        >
          {CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  )
}

function Breakdown({ title, rows, breakdown, total, currency, type }) {
  const visibleRows = rows.filter((row) => breakdown[row.key]?.amountBase > 0)
  if (!visibleRows.length) return null

  return (
    <Card pad="lg">
      <div className="text-xs font-semibold text-ink-muted/70 dark:text-white/38">
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {visibleRows.map((row) => {
          const amount = breakdown[row.key].amountBase
          const pct = total > 0 ? (amount / total) * 100 : 0
          return (
            <div key={row.key}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs text-ink-muted/80 dark:text-white/40">
                <span>{row.label}</span>
                <span>{formatCurrency(amount, currency)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]">
                <div
                  className={type === 'asset' ? 'h-full rounded-full bg-positive' : 'h-full rounded-full bg-negative'}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function NetWorthCalculator() {
  const { navigateTo, openPaddock } = usePublicNavigation()
  const [baseCurrency, setBaseCurrency] = useState('GBP')
  const [showMultiCurrency, setShowMultiCurrency] = useState(false)
  const [rows, setRows] = useState(() => makeRows('GBP'))

  useSEO({
    title: 'Net Worth Calculator UK — Paddock',
    description:
      'Free net worth calculator. Add assets and liabilities to see your total net worth instantly.',
    canonicalPath: '/tools/net-worth-calculator',
  })

  const result = useMemo(() => calculateNetWorth({ baseCurrency, rows }), [baseCurrency, rows])
  const setRow = (key, field, value) => {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

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
          <ToolIntro kicker="Wealth snapshot tool" title="Net Worth Calculator UK">
            Enter your assets and liabilities to see your total net worth, including cash,
            investments, pensions, property, and debts.
          </ToolIntro>

          <Card className="mt-8" pad="lg">
            <div className="space-y-7">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <SelectField label="Base currency" value={baseCurrency} onChange={setBaseCurrency} options={CURRENCIES} />
                <label className="flex h-12 items-center gap-3 rounded-2xl border border-black/[.08] px-4 text-sm font-semibold text-ink dark:border-white/[.08] dark:text-white">
                  <input
                    type="checkbox"
                    checked={showMultiCurrency}
                    onChange={(event) => setShowMultiCurrency(event.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  Multi-currency
                </label>
              </div>

              <div className="space-y-4 border-t border-black/[.06] pt-6 dark:border-white/[.07]">
                <div className="text-[13px] font-semibold text-ink dark:text-white">
                  Assets
                </div>
                {ASSET_ROWS.map((row) => (
                  <EntryRow key={row.key} row={row} value={rows[row.key]} onChange={setRow} showCurrency={showMultiCurrency} />
                ))}
              </div>

              <div className="space-y-4 border-t border-black/[.06] pt-6 dark:border-white/[.07]">
                <div className="text-[13px] font-semibold text-ink dark:text-white">
                  Liabilities
                </div>
                {LIABILITY_ROWS.map((row) => (
                  <EntryRow key={row.key} row={row} value={rows[row.key]} onChange={setRow} showCurrency={showMultiCurrency} />
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="public-tool-results space-y-4">
          {result.isEmpty ? (
            <Card pad="lg">
              <p className="text-sm leading-7 text-ink-muted/80 dark:text-white/45">
                Enter assets and liabilities to see your net worth update instantly.
              </p>
            </Card>
          ) : (
            <>
              <Stat label="Net worth" value={formatCurrency(result.netWorth, baseCurrency)} note={result.netWorth >= 0 ? 'Assets exceed liabilities' : 'Liabilities exceed assets'} highlight />
              <Stat label="Total assets" value={formatCurrency(result.totalAssets, baseCurrency)} />
              <Stat label="Total liabilities" value={formatCurrency(result.totalLiabilities, baseCurrency)} />
              <Breakdown title="Asset breakdown" rows={ASSET_ROWS} breakdown={result.assetBreakdown} total={result.totalAssets} currency={baseCurrency} type="asset" />
              <Breakdown title="Liability breakdown" rows={LIABILITY_ROWS} breakdown={result.liabilityBreakdown} total={result.totalLiabilities} currency={baseCurrency} type="liability" />
            </>
          )}
          {result.hasMultiCurrency ? (
            <p className="text-xs leading-6 text-ink-muted/70 dark:text-white/32">
              Currency conversion uses approximate planning rates and is not live market data.
            </p>
          ) : null}
          <ToolCTA onClick={openPaddock}>Save and track your net worth over time with Paddock.</ToolCTA>
          <p className="text-xs leading-6 text-ink-muted/70 dark:text-white/32">
            Based on the values you enter. This tool is not financial advice.
          </p>
        </div>
      </div>
    </PublicShell>
  )
}
