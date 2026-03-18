export function numFrom(input, fallback = 0) {
    const n = Number(String(input ?? '').replace(/,/g, ''))
    return Number.isFinite(n) ? n : fallback
  }
  
  export function clampPercent(value) {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(100, value))
  }
  
  export function getUkTaxYearSnapshot(now = new Date()) {
    const year = now.getFullYear()
    const month = now.getMonth()
    const day = now.getDate()
  
    const startYear = month > 3 || (month === 3 && day >= 6) ? year : year - 1
    const start = new Date(startYear, 3, 6, 0, 0, 0, 0)
    const end = new Date(startYear + 1, 3, 5, 23, 59, 59, 999)
  
    const msPerDay = 24 * 60 * 60 * 1000
    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerDay))
    const monthsRemaining = Math.max(0, daysRemaining / 30.4375)
  
    return {
      startYear,
      start,
      end,
      label: `${startYear}/${String(startYear + 1).slice(-2)}`,
      daysRemaining,
      monthsRemaining,
    }
  }
  
  const ISA_RULES = {
    annualAllowance: 20000,
    lisaAllowance: 4000,
    juniorAllowance: 9000,
  }
  
  export function getIsaRules() {
    return ISA_RULES
  }
  
  function inferGoalIntent(goal) {
    const text = `${goal?.name || ''} ${goal?.goal_type || ''}`.toLowerCase()
  
    if (
      /first home|home deposit|house deposit|property deposit|first property|house|home|property/.test(
        text
      )
    ) {
      return 'home'
    }
  
    if (/retire|retirement|freedom|financial independence|fi|fire/.test(text)) {
      return 'retirement'
    }
  
    return 'general'
  }
  
  function getConfidence(score) {
    if (score >= 85) return 'Strong fit'
    if (score >= 65) return 'Good fit'
    return 'Worth checking'
  }
  
  export function formatShortDate(date) {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
    }).format(date)
  }
  
  export function getPlanIsaGuidance({
    goal,
    derived,
    status,
    localContrib,
    isaUsedYtd,
    isaMonthly,
  }) {
    const taxYear = getUkTaxYearSnapshot()
    const rules = getIsaRules()
  
    const currentAge = numFrom(goal?.current_age ?? goal?.currentAge, 0)
    const yearsRemaining = numFrom(derived?.yearsRemaining, 0)
    const planPace = Math.max(0, numFrom(localContrib, 0))
    const usedYtd = Math.max(0, numFrom(isaUsedYtd, 0))
    const monthlyIsa = Math.max(0, numFrom(isaMonthly, 0))
    const intent = inferGoalIntent(goal)
  
    const remainingAllowance = Math.max(0, rules.annualAllowance - usedYtd)
    const projectedEndUsed = Math.min(
      rules.annualAllowance,
      usedYtd + monthlyIsa * taxYear.monthsRemaining
    )
    const projectedUnusedAllowance = Math.max(0, rules.annualAllowance - projectedEndUsed)
  
    const monthlyNeededToUseAll =
      taxYear.monthsRemaining > 0 ? remainingAllowance / taxYear.monthsRemaining : remainingAllowance
  
    const extraNeeded = Math.max(0, monthlyNeededToUseAll - monthlyIsa)
  
    const lisaEligible = currentAge >= 18 && currentAge < 40
    const currentProgressPct = clampPercent((usedYtd / rules.annualAllowance) * 100)
    const projectedProgressPct = clampPercent((projectedEndUsed / rules.annualAllowance) * 100)
  
    let recommendedWrapper = 'Stocks & Shares ISA'
    let wrapperKey = 'stocks'
    let score = 72
    let primaryReason =
      'Your plan still looks long term, so growth plus tax sheltering is usually the strongest default.'
    let secondaryReason =
      'This is generally the cleanest wrapper for long-horizon wealth building inside Plan.'
    let nextActionTitle = 'Set an intentional ISA pace'
    let nextActionBody =
      extraNeeded > 0
        ? `At your current ISA pace, some allowance may go unused. Increasing ISA funding by about £${Math.ceil(extraNeeded)}/mo would put you on track to use the full remaining allowance this tax year.`
        : 'Your current ISA pace looks broadly sufficient to use the remaining allowance by tax-year end.'
    let watchout =
      'ISA funding and total plan funding are not always the same thing. Treat this as wrapper guidance, not a full tax plan.'
  
    if (intent === 'home' && lisaEligible) {
      wrapperKey = 'lisa'
      recommendedWrapper = 'Lifetime ISA'
      score = 91
      primaryReason =
        'For an eligible first-home plan, the Lifetime ISA is usually the highest-value wrapper because of the government bonus.'
      secondaryReason =
        'The bonus can materially improve progress, provided the home goal and withdrawal rules genuinely fit your situation.'
      nextActionTitle =
        usedYtd >= rules.lisaAllowance
          ? 'LISA portion already used'
          : `Prioritise up to £${rules.lisaAllowance.toLocaleString()} into LISA`
      nextActionBody =
        usedYtd >= rules.lisaAllowance
          ? 'You may already have used the LISA-sized portion of annual ISA capacity. Additional tax-sheltered saving would usually sit in another ISA wrapper.'
          : 'If this is a genuine first-home plan and you are eligible, filling the LISA portion first is usually the strongest next step.'
      watchout =
        'Lifetime ISA withdrawals are more restrictive than standard ISAs. Non-qualifying withdrawals normally trigger a 25% charge.'
    } else if (yearsRemaining > 0 && yearsRemaining <= 5) {
      wrapperKey = 'cash'
      recommendedWrapper = 'Cash ISA'
      score = status === 'ahead' ? 88 : 77
      primaryReason =
        status === 'ahead'
          ? 'You are relatively close to the target and already ahead, so protecting progress may matter more than chasing extra return.'
          : 'The horizon is short enough that capital stability may matter more than long-run growth.'
      secondaryReason =
        'Near-term goal money often benefits from lower volatility and cleaner access rather than a more aggressive growth profile.'
      nextActionTitle =
        extraNeeded > 0 ? `Add about £${Math.ceil(extraNeeded)}/mo to use the allowance` : 'Keep ISA pace steady'
      nextActionBody =
        extraNeeded > 0
          ? 'You still have useful tax shelter left this year. A modest increase in ISA funding would help you use it without adding unnecessary complexity.'
          : 'Your current ISA pace looks reasonable for using the remaining allowance before year-end.'
      watchout =
        'Cash can protect a near-term target, but it may lag inflation over longer periods.'
    } else {
      wrapperKey = 'stocks'
      recommendedWrapper = 'Stocks & Shares ISA'
      score = status === 'adjust' ? 79 : 84
      primaryReason =
        status === 'adjust'
          ? 'You still need plan growth and contribution efficiency, so a long-term growth wrapper is usually the strongest fit.'
          : 'You have enough runway left that long-term tax-sheltered growth is usually the best default.'
      secondaryReason =
        'For general long-horizon wealth building, this is often the most efficient wrapper to fund first.'
      nextActionTitle =
        extraNeeded > 0 ? `Increase ISA funding by about £${Math.ceil(extraNeeded)}/mo` : 'Keep funding the wrapper consistently'
      nextActionBody =
        extraNeeded > 0
          ? 'That would put you on track to use more of the remaining ISA allowance this tax year.'
          : 'Your current ISA funding pace looks broadly aligned with using the remaining allowance by year-end.'
      watchout =
        'A Stocks & Shares ISA is usually a long-horizon wrapper. It is less suitable for money you may need in the near term.'
    }
  
    if (planPace > 0 && monthlyIsa === 0) {
      nextActionTitle = 'Decide how much of the plan should be ISA-funded'
      nextActionBody = `Your plan pace is £${Math.round(planPace).toLocaleString()}/mo, but none of it is currently earmarked for ISA funding. Start by deciding what portion should be sheltered.`
    }
  
    const canUseAllAllowance = projectedUnusedAllowance <= 1
    const needsMoreIsaFunding = extraNeeded > 1
    const suggestedMonthlyIsa =
      remainingAllowance <= 0 ? 0 : canUseAllAllowance ? monthlyIsa : Math.ceil(monthlyNeededToUseAll)
  
    return {
      taxYear,
      rules,
      wrapperKey,
      recommendedWrapper,
      confidence: getConfidence(score),
      primaryReason,
      secondaryReason,
      nextActionTitle,
      nextActionBody,
      watchout,
      remainingAllowance,
      projectedUnusedAllowance,
      monthlyNeededToUseAll,
      currentProgressPct,
      projectedProgressPct,
      extensionPct: Math.max(0, projectedProgressPct - currentProgressPct),
      canUseAllAllowance,
      needsMoreIsaFunding,
      suggestedMonthlyIsa,
    }
  }