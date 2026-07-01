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

export function fmtCurrencyCompactShort(amount, ccy = 'GBP') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'

  const c = ccy || 'GBP'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const symbol = CURRENCY_SYMBOLS[c] || `${c} `
  const trim = (v) => String(v).replace(/\.0$/, '').replace(/(\.\d*[1-9])0$/, '$1')

  if (abs >= 1_000_000) {
    const value = abs / 1_000_000
    const decimals = value < 10 && !Number.isInteger(value) ? 1 : 0
    return `${sign}${symbol}${trim(value.toFixed(decimals))}m`
  }

  if (abs >= 1_000) {
    const value = abs / 1_000
    const decimals = value < 10 && !Number.isInteger(value) ? 1 : 0
    return `${sign}${symbol}${trim(value.toFixed(decimals))}k`
  }

  return fmtCurrency(n, c)
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

// v1.1 — UK-native subtype display names.
// Keys match the account_subtype raw strings from the backend.
// Unknown future values are simply absent here; displayAccountLabel() falls
// back to ACCOUNT_TYPE_LABELS so the app never crashes on unrecognised values.
export const ACCOUNT_SUBTYPE_LABELS = {
  current_account:   'Current Account',
  savings:           'Savings Account',
  cash_isa:          'Cash ISA',
  premium_bonds:     'Premium Bonds',
  stocks_shares_isa: 'Stocks & Shares ISA',
  lifetime_isa:      'Lifetime ISA',
  gia:               'General Investment Account',
  workplace_pension: 'Workplace Pension',
  credit_card:       'Credit Card',
  other_liability:   'Other Liability',
}

/**
 * Returns the most specific display label for an account.
 * Prefers the subtype label when known; falls back to broad type label.
 * Never throws — unknown subtype strings produce the type label, not a crash.
 */
export function displayAccountLabel(account) {
  if (account?.account_subtype) {
    const sub = ACCOUNT_SUBTYPE_LABELS[account.account_subtype]
    if (sub) return sub
  }
  return ACCOUNT_TYPE_LABELS[account?.type] || account?.type || 'Account'
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

export function fmtCurrencyCompactStable(amount, ccy = 'GBP') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return fmtCurrencyCompact(amount, ccy)

  const c = ccy || 'GBP'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const symbol = CURRENCY_SYMBOLS[c] || `${c} `

  const trimMillions = (v) =>
    String(v).replace(/\.0$/, '').replace(/(\.\d*[1-9])0$/, '$1')

  if (abs >= 1_000_000) {
    return `${sign}${symbol}${trimMillions((abs / 1_000_000).toFixed(2))}M`
  }

  if (abs >= 10_000) {
    return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`
  }

  return fmtCurrency(n, c)
}

// ── Wealth Group Taxonomy ─────────────────────────────────────────────────
//
// Canonical group definitions for the v1.1 UK wealth structure.
// Display order is intentional — "other" is last so it acts as a catch-all.
// subtypeOverrides are checked before broad types so e.g. cash_isa lands in
// Cash & Savings rather than ISAs & Investments.
// Unknown future subtype strings fall through to broad-type lookup safely.

export const WEALTH_GROUPS = [
  {
    key: 'cash',
    label: 'Cash & Savings',
    types: ['bank'],
    subtypeOverrides: ['current_account', 'savings', 'cash_isa', 'premium_bonds'],
    isLiability: false,
  },
  {
    key: 'investments',
    label: 'ISAs & Investments',
    types: ['isa', 'investment', 'crypto'],
    subtypeOverrides: ['stocks_shares_isa', 'lifetime_isa', 'gia'],
    isLiability: false,
  },
  {
    key: 'pensions',
    label: 'Pensions',
    types: ['sipp'],
    subtypeOverrides: ['workplace_pension'],
    isLiability: false,
  },
  {
    key: 'property',
    label: 'Property',
    types: ['property'],
    subtypeOverrides: [],
    isLiability: false,
  },
  {
    key: 'liabilities',
    label: 'Liabilities',
    types: ['mortgage', 'loan'],
    subtypeOverrides: ['credit_card', 'other_liability'],
    isLiability: true,
  },
  {
    key: 'other',
    label: 'Other',
    types: ['other'],
    subtypeOverrides: [],
    isLiability: false,
  },
]

/**
 * Returns the single WEALTH_GROUPS entry an account belongs to.
 * Subtype overrides are checked first; then broad type; then "Other" catch-all.
 * An account always lands in exactly one group — no double-counting.
 * Unknown future subtype strings never crash; they fall through to the type lookup.
 */
export function groupDefFor(account) {
  const sub = account.account_subtype
  if (sub) {
    const bySubtype = WEALTH_GROUPS.find(g => g.subtypeOverrides.includes(sub))
    if (bySubtype) return bySubtype
  }
  const byType = WEALTH_GROUPS.find(g => g.types.includes(account.type))
  if (byType) return byType
  return WEALTH_GROUPS[WEALTH_GROUPS.length - 1] // "other" catch-all
}

// ── Account freshness ─────────────────────────────────────────────────────

/**
 * Returns a structured freshness label for an account's last update time.
 * Freshness is a trust signal — tells users how current the account data is.
 * Returns null when updatedAt is missing, unparseable, or in the future.
 *
 * States and thresholds:
 *   fresh  — 0–13 days  (Updated today / yesterday / X days ago)
 *   aging  — 14–29 days (Review soon)
 *   stale  — 30+ days   (Needs review)
 */
export function accountFreshnessLabel(updatedAt) {
  if (!updatedAt) return null
  const ms = Date.now() - new Date(updatedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const days = Math.floor(ms / 86400000)
  if (days === 0) return { state: 'fresh', label: 'Updated today',            days }
  if (days === 1) return { state: 'fresh', label: 'Updated yesterday',        days }
  if (days < 14)  return { state: 'fresh', label: `Updated ${days} days ago`, days }
  if (days < 30)  return { state: 'aging', label: 'Review soon',              days }
  return               { state: 'stale', label: 'Needs review',             days }
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

export function getSnapshotFreshnessState(
  snapshotDate,
  { agingDays = 7, staleDays = 30 } = {}
) {
  if (!snapshotDate) return { state: 'missing', days: Infinity }

  const days = getDaysSinceSnapshot(snapshotDate)

  if (days >= staleDays) return { state: 'stale', days }
  if (days >= agingDays) return { state: 'aging', days }

  return { state: 'fresh', days }
}

/**
 * Maps a derived forecast object to a plan status string.
 * Returns 'no_goal' when derived is absent.
 */
export function getPlanStatus(derived) {
  if (!derived) return 'no_goal'
  const s = derived.status
  if (s === 'ahead') return 'ahead'
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
