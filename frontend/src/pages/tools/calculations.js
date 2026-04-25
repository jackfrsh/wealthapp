export function parseMoney(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

export function parseRate(value) {
  return parseMoney(value) / 100
}

function monthlyRate(annualReturn, annualFee = 0) {
  const net = annualReturn - annualFee
  if (Math.abs(net) < 1e-12) return 0
  return Math.pow(1 + net, 1 / 12) - 1
}

function futureValue(presentValue, monthlyContribution, rateMonthly, months) {
  if (months <= 0) return presentValue
  if (Math.abs(rateMonthly) < 1e-12) return presentValue + monthlyContribution * months
  const factor = Math.pow(1 + rateMonthly, months)
  return presentValue * factor + (monthlyContribution * (factor - 1)) / rateMonthly
}

function simulateDrawdown({
  startPot,
  annualReturn,
  annualFee,
  withdrawalMode,
  annualWithdrawalPct,
  fixedMonthlyAmount,
  retirementAge,
  targetEndAge,
}) {
  const rate = monthlyRate(annualReturn, annualFee)
  const totalMonths = Math.ceil((targetEndAge - retirementAge) * 12)
  let balance = startPot

  for (let month = 1; month <= totalMonths; month += 1) {
    balance *= 1 + rate
    balance -= withdrawalMode === 'percentage'
      ? balance * (annualWithdrawalPct / 12)
      : fixedMonthlyAmount

    if (balance <= 1) {
      return {
        exhaustedAge: Math.round((retirementAge + month / 12) * 10) / 10,
        potAtTargetAge: 0,
      }
    }
  }

  return { exhaustedAge: null, potAtTargetAge: Math.round(balance) }
}

export function calculateDrawdown(inputs) {
  const errors = []
  const pot = parseMoney(inputs.pot)
  const currentAge = parseMoney(inputs.currentAge)
  const retirementAge = parseMoney(inputs.retirementAge)
  const targetEndAge = parseMoney(inputs.targetEndAge)
  const monthlyContribution = parseMoney(inputs.monthlyContribution)
  const annualReturn = parseRate(inputs.annualReturn)
  const annualFee = parseRate(inputs.annualFee)
  const lumpSum = parseMoney(inputs.lumpSum)
  const annualWithdrawalPct = parseRate(inputs.annualWithdrawalPct)
  const fixedMonthlyAmount = parseMoney(inputs.fixedMonthlyAmount)
  const withdrawalMode = inputs.withdrawalMode || 'percentage'

  if (pot < 0) errors.push('Pension pot cannot be negative.')
  if (currentAge < 18 || currentAge > 80) errors.push('Current age must be between 18 and 80.')
  if (retirementAge <= currentAge || retirementAge > 90) errors.push('Retirement age must be greater than current age and 90 or under.')
  if (targetEndAge <= retirementAge || targetEndAge > 100) errors.push('Target end age must be greater than retirement age and 100 or under.')
  if (monthlyContribution < 0) errors.push('Monthly contribution cannot be negative.')
  if (annualReturn < 0 || annualReturn > 0.2) errors.push('Expected annual return must be between 0% and 20%.')
  if (annualFee < 0 || annualFee > 0.05) errors.push('Annual fee must be between 0% and 5%.')
  if (lumpSum < 0) errors.push('Lump sum cannot be negative.')
  if (withdrawalMode === 'percentage' && (annualWithdrawalPct < 0 || annualWithdrawalPct > 0.2)) errors.push('Withdrawal rate must be between 0% and 20%.')
  if (withdrawalMode === 'fixed' && fixedMonthlyAmount < 0) errors.push('Fixed monthly amount cannot be negative.')
  if (errors.length) return { ok: false, errors }

  const monthsToRetirement = Math.round((retirementAge - currentAge) * 12)
  const potAtRetirement = Math.max(
    0,
    Math.round(futureValue(pot, monthlyContribution, monthlyRate(annualReturn, annualFee), monthsToRetirement))
  )
  const lumpSumApplied = Math.min(lumpSum, potAtRetirement)
  const potAfterLumpSum = potAtRetirement - lumpSumApplied
  const monthlyIncome = withdrawalMode === 'percentage'
    ? Math.round(potAfterLumpSum * (annualWithdrawalPct / 12))
    : Math.round(fixedMonthlyAmount)

  const primary = simulateDrawdown({
    startPot: potAfterLumpSum,
    annualReturn,
    annualFee,
    withdrawalMode,
    annualWithdrawalPct,
    fixedMonthlyAmount: monthlyIncome,
    retirementAge,
    targetEndAge,
  })

  const comparison = [0.03, 0.04, 0.05].map((rate) => {
    const monthlyIncomeAtRate = Math.round(potAfterLumpSum * (rate / 12))
    const simulation = simulateDrawdown({
      startPot: potAfterLumpSum,
      annualReturn,
      annualFee,
      withdrawalMode: 'percentage',
      annualWithdrawalPct: rate,
      fixedMonthlyAmount: 0,
      retirementAge,
      targetEndAge,
    })
    return {
      rate,
      rateLabel: `${(rate * 100).toFixed(0)}%`,
      monthlyIncome: monthlyIncomeAtRate,
      annualIncome: monthlyIncomeAtRate * 12,
      exhaustedAge: simulation.exhaustedAge,
      potAtTargetAge: simulation.potAtTargetAge,
    }
  })

  return {
    ok: true,
    potAtRetirement,
    lumpSumApplied,
    potAfterLumpSum,
    monthlyIncome,
    annualIncome: monthlyIncome * 12,
    exhaustedAge: primary.exhaustedAge,
    potAtTargetAge: primary.potAtTargetAge,
    comparison,
  }
}

function yearsToTarget({ currentAssets, annualContributions, annualReturn, target }) {
  if (target <= 0 || currentAssets >= target) return 0
  if (annualContributions <= 0 && annualReturn <= 0) return null

  let balance = currentAssets
  for (let year = 1; year <= 60; year += 1) {
    balance = balance * (1 + annualReturn) + annualContributions
    if (balance >= target) return year
  }
  return null
}

export function calculateFire(inputs) {
  const annualSpending = parseMoney(inputs.annualSpending)
  const passiveIncome = parseMoney(inputs.passiveIncome)
  const withdrawalRate = parseRate(inputs.withdrawalRate)
  const currentAssets = parseMoney(inputs.currentAssets)
  const annualContributions = parseMoney(inputs.annualContributions)
  const annualReturn = parseRate(inputs.annualReturn)
  const errors = []

  if (annualSpending < 0) errors.push('Annual spending cannot be negative.')
  if (passiveIncome < 0) errors.push('Passive income cannot be negative.')
  if (withdrawalRate < 0.005 || withdrawalRate > 0.2) errors.push('Withdrawal rate must be between 0.5% and 20%.')
  if (currentAssets < 0) errors.push('Current invested assets cannot be negative.')
  if (annualContributions < 0) errors.push('Annual contributions cannot be negative.')
  if (annualReturn < 0 || annualReturn > 0.2) errors.push('Expected annual return must be between 0% and 20%.')
  if (errors.length) return { ok: false, errors }

  const annualNeeded = Math.max(annualSpending - passiveIncome, 0)
  const fireNumber = withdrawalRate > 0 ? Math.round(annualNeeded / withdrawalRate) : Infinity
  const gap = Math.max(fireNumber - currentAssets, 0)
  const progressPct = fireNumber > 0 ? Math.min((currentAssets / fireNumber) * 100, 100) : 100
  const yearsToFI = yearsToTarget({ currentAssets, annualContributions, annualReturn, target: fireNumber })
  const comparison = [0.035, 0.04, 0.045].map((rate) => {
    const target = Math.round(annualNeeded / rate)
    return {
      rate,
      rateLabel: `${(rate * 100).toFixed(1)}%`,
      fireNumber: target,
      gap: Math.max(target - currentAssets, 0),
      yearsToFI: yearsToTarget({ currentAssets, annualContributions, annualReturn, target }),
    }
  })

  return { ok: true, annualNeeded, fireNumber, currentAssets, gap, progressPct, yearsToFI, comparison }
}

export function calculateIsa(inputs) {
  const initialAmount = parseMoney(inputs.initialAmount)
  const monthlyContribution = parseMoney(inputs.monthlyContribution)
  const years = parseMoney(inputs.years)
  const annualReturn = parseMoney(inputs.annualReturn)
  const annualFee = parseMoney(inputs.annualFee)
  const targetValue = parseMoney(inputs.targetValue)
  const errors = []

  if (initialAmount < 0) errors.push('Initial amount cannot be negative.')
  if (monthlyContribution < 0) errors.push('Monthly contribution cannot be negative.')
  if (years < 1 || years > 50) errors.push('Years must be between 1 and 50.')
  if (annualReturn < 0 || annualReturn > 20) errors.push('Annual return must be between 0% and 20%.')
  if (annualFee < 0 || annualFee > 5) errors.push('Annual fee must be between 0% and 5%.')
  if (inputs.targetValue && targetValue <= 0) errors.push('Target value must be greater than zero.')
  if (errors.length) return { ok: false, errors }

  const project = (returnPct) => {
    const months = Math.round(years * 12)
    const projectedValue = futureValue(
      initialAmount,
      monthlyContribution,
      monthlyRate(returnPct / 100, annualFee / 100),
      months
    )
    const totalContributed = initialAmount + monthlyContribution * months
    return {
      projectedValue,
      totalContributed,
      totalGrowth: projectedValue - totalContributed,
    }
  }

  const primary = project(annualReturn)
  const targetProgressPct = targetValue > 0 ? Math.min((primary.projectedValue / targetValue) * 100, 100) : null
  const comparison = [3, 5, 7].map((rate) => ({
    rate: rate / 100,
    rateLabel: `${rate}%`,
    ...project(rate),
  }))

  return { ok: true, ...primary, targetProgressPct, comparison }
}

export const CURRENCIES = ['GBP', 'USD', 'EUR', 'CHF', 'AUD', 'CAD', 'JPY', 'SEK', 'NOK', 'DKK']

export const CURRENCY_SYMBOLS = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  CHF: 'Fr',
  AUD: 'A$',
  CAD: 'C$',
  JPY: '¥',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
}

const RATES_TO_GBP = {
  GBP: 1,
  USD: 0.79,
  EUR: 0.85,
  CHF: 0.89,
  AUD: 0.5,
  CAD: 0.57,
  JPY: 0.0052,
  SEK: 0.073,
  NOK: 0.073,
  DKK: 0.114,
}

export const ASSET_ROWS = [
  { key: 'cash', label: 'Cash & savings' },
  { key: 'investments', label: 'Investments' },
  { key: 'pensions', label: 'Pensions' },
  { key: 'property', label: 'Property' },
  { key: 'otherAssets', label: 'Other assets' },
]

export const LIABILITY_ROWS = [
  { key: 'mortgage', label: 'Mortgage' },
  { key: 'loans', label: 'Loans & credit' },
  { key: 'otherLiabilities', label: 'Other liabilities' },
]

export function calculateNetWorth({ baseCurrency, rows }) {
  const safeBase = CURRENCIES.includes(baseCurrency) ? baseCurrency : 'GBP'
  const convert = (amount, currency) => {
    if (currency === safeBase) return amount
    return (amount * (RATES_TO_GBP[currency] ?? 1)) / (RATES_TO_GBP[safeBase] ?? 1)
  }
  const invalidRows = []
  const readRow = (key) => {
    const row = rows[key] || { amount: '', currency: safeBase }
    const amount = parseMoney(row.amount)
    if (String(row.amount ?? '').trim() !== '' && amount === 0 && Number(String(row.amount).replace(/,/g, '')) !== 0) {
      invalidRows.push(key)
    }
    return convert(Math.max(0, amount), CURRENCIES.includes(row.currency) ? row.currency : safeBase)
  }

  const assetBreakdown = {}
  const liabilityBreakdown = {}
  let totalAssets = 0
  let totalLiabilities = 0

  ASSET_ROWS.forEach(({ key }) => {
    const amountBase = readRow(key)
    totalAssets += amountBase
    assetBreakdown[key] = { amountBase, pct: 0 }
  })

  LIABILITY_ROWS.forEach(({ key }) => {
    const amountBase = readRow(key)
    totalLiabilities += amountBase
    liabilityBreakdown[key] = { amountBase, pct: 0 }
  })

  ASSET_ROWS.forEach(({ key }) => {
    assetBreakdown[key].pct = totalAssets > 0 ? (assetBreakdown[key].amountBase / totalAssets) * 100 : 0
  })
  LIABILITY_ROWS.forEach(({ key }) => {
    liabilityBreakdown[key].pct = totalLiabilities > 0 ? (liabilityBreakdown[key].amountBase / totalLiabilities) * 100 : 0
  })

  return {
    ok: true,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    assetBreakdown,
    liabilityBreakdown,
    hasMultiCurrency: Object.values(rows).some((row) => row?.currency && row.currency !== safeBase),
    invalidRows,
    isEmpty: totalAssets === 0 && totalLiabilities === 0,
  }
}
