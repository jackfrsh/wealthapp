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
