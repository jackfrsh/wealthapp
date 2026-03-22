export function fmtCurrency(amount, ccy = 'GBP') {
  const c = ccy || 'GBP'
  try {
    if (c === 'BTC' || c === 'ETH') {
      return `${Number(amount).toFixed(c === 'BTC' ? 8 : 6)} ${c}`
    }
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${c} ${Number(amount).toLocaleString()}`
  }
}

export function fmtCurrencyCompact(amount, ccy = 'GBP') {
  const c = ccy || 'GBP'
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  try {
    if (abs >= 1_000_000) {
      return `${sign}${new Intl.NumberFormat('en-GB', { style: 'currency', currency: c, maximumFractionDigits: 1 }).format(abs / 1_000_000).replace(/^(.)/, '$1')}M`
    }
    if (abs >= 10_000) {
      return `${sign}${new Intl.NumberFormat('en-GB', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(abs / 1_000)}K`
    }
    return fmtCurrency(amount, ccy)
  } catch {
    return fmtCurrency(amount, ccy)
  }
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function fmtDateShort(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
}

export function fmtPct(pct) {
  const p = Number(pct)
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%'
}

export function fmtNumber(n) {
  return Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

export const ACCOUNT_TYPE_LABELS = {
  bank: 'Bank',
  isa: 'ISA',
  sipp: 'Pension',
  crypto: 'Crypto',
  investment: 'Investment',
  property: 'Property',
  mortgage: 'Mortgage',
  loan: 'Loan',
  other: 'Other',
}

import {
  Landmark,
  Shield,
  Building2,
  Coins,
  TrendingUp,
  Home,
  Construction,
  CreditCard,
  Package,
} from 'lucide-react'

export const ACCOUNT_TYPE_ICONS = {
  bank: Landmark,
  isa: Shield,
  sipp: Building2,
  crypto: Coins,
  investment: TrendingUp,
  property: Home,
  mortgage: Construction,
  loan: CreditCard,
  other: Package,
}

export const CURRENCIES = ['GBP', 'USD', 'EUR', 'CHF', 'AUD', 'CAD', 'JPY', 'SEK', 'NOK', 'SGD', 'NZD', 'HKD', 'INR', 'BTC', 'ETH']

export const CURRENCY_SYMBOLS = {
  GBP: '£', USD: '$', EUR: '€', CHF: 'Fr', AUD: 'A$', CAD: 'C$',
  JPY: '¥', SEK: 'kr', NOK: 'kr', SGD: 'S$', NZD: 'NZ$', HKD: 'HK$',
  INR: '₹', BTC: '₿', ETH: 'Ξ',
}

// ── Plan signal helpers ────────────────────────────────────────────────────

/** Days remaining until the UK tax year ends (5 April). */
export function daysUntilTaxYearEnd() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
  const endYear = m > 3 || (m === 3 && d >= 6) ? y + 1 : y
  const end = new Date(endYear, 3, 5, 23, 59, 59)
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

/**
 * True when ISA urgency should be shown.
 * Only uses backend-provided isaRemaining — returns false if null/undefined.
 */
export function isIsaUrgent(isaRemaining) {
  if (isaRemaining == null) return false
  return isaRemaining > 500 && daysUntilTaxYearEnd() <= 90
}

/** Calendar days elapsed since a snapshot date string or Date. */
export function getDaysSinceSnapshot(snapshotDate) {
  if (!snapshotDate) return Infinity
  return Math.floor((Date.now() - new Date(snapshotDate).getTime()) / 86400000)
}

/** True when the snapshot is older than thresholdDays (default 30). */
export function isSnapshotStale(snapshotDate, thresholdDays = 30) {
  return getDaysSinceSnapshot(snapshotDate) >= thresholdDays
}

/**
 * Maps a derived forecast object to a plan status string.
 * Returns 'no_goal' when derived is absent.
 */
export function getPlanStatus(derived) {
  if (!derived) return 'no_goal'
  const s = derived.status
  if (s === 'on_track') return 'on_track'
  if (s === 'adjust') return 'adjust'
  return 'no_goal'
}

/**
 * Returns the default Decisions tab based on ISA urgency.
 * Falls back to mortgage-overpayment when ISA data is absent or not urgent.
 */
export function getDecisionsDefaultTab(isaRemaining) {
  return isIsaUrgent(isaRemaining) ? 'isa' : 'mortgage-overpayment'
}
