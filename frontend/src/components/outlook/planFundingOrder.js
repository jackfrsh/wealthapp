import { getPlanIsaGuidance, numFrom } from './planIsaGuidance'

function fmtGBPWhole(value) {
  return `£${Math.round(Number(value || 0)).toLocaleString()}`
}

export function getPlanFundingOrder({
  goal,
  derived,
  status,
  localContrib,
  isaUsedYtd,
  isaMonthly,
}) {
  const isa = getPlanIsaGuidance({
    goal,
    derived,
    status,
    localContrib,
    isaUsedYtd,
    isaMonthly,
  })

  const yearsRemaining = Math.max(0, numFrom(derived?.yearsRemaining, 0))
  const planPace = Math.max(0, numFrom(localContrib, 0))
  const monthlyIsaValue = Math.max(0, numFrom(isaMonthly, 0))

  const remainingAllowance = Math.max(0, Number(isa.remainingAllowance || 0))
  const safeLisaHeadroom = Math.max(
    0,
    Math.min(Number(isa.rules?.lisaAllowance || 0), remainingAllowance)
  )

  const priorities = []
  let summary =
    'Use wrappers in a deliberate order so the next pound goes where it does the most work for this plan.'

  if (isa.wrapperKey === 'lisa') {
    summary =
      'For this plan, use the highest-value wrapper first, then use remaining ISA room, then decide where overflow should live.'

    priorities.push({
      key: 'lisa',
      level: 'Priority 1',
      title: 'Prioritise Lifetime ISA',
      amountText:
        safeLisaHeadroom > 0
          ? `Up to ${fmtGBPWhole(safeLisaHeadroom)} this tax year`
          : 'Check LISA headroom',
      body:
        'For an eligible first-home plan, this is usually the most valuable first destination because of the government bonus.',
      watchout:
        'This is an “up to” figure based on annual ISA room, not confirmed LISA usage. Withdrawal rules are tighter than a standard ISA.',
      emphasis: 'primary',
    })

    priorities.push({
      key: 'remaining_isa',
      level: 'Priority 2',
      title: 'Then use remaining ISA allowance',
      amountText:
        remainingAllowance > 0
          ? `${fmtGBPWhole(remainingAllowance)} annual ISA room left`
          : 'Annual ISA allowance already used',
      body:
        remainingAllowance > 0
          ? 'After the LISA-first step, keep the rest of this year’s tax shelter working for you in the most suitable ISA wrapper.'
          : 'You appear to have already used the annual ISA allowance, so further funding would sit outside ISA wrappers.',
      watchout:
        'This priority is about wrapper order, not asset allocation.',
      emphasis: 'secondary',
    })
  } else if (isa.wrapperKey === 'cash') {
    summary =
      'This plan is close enough that preserving progress matters. Protect near-term money first, then make sure you are using wrapper capacity deliberately.'

    priorities.push({
      key: 'cash_isa',
      level: 'Priority 1',
      title: 'Protect near-term funds in Cash ISA',
      amountText:
        remainingAllowance > 0
          ? `${fmtGBPWhole(remainingAllowance)} annual ISA room left`
          : 'Annual ISA allowance already used',
      body:
        'For a shorter runway, capital stability and cleaner access can matter more than stretching for extra return.',
      watchout:
        'Cash can protect the target, but over longer periods it may lag inflation.',
      emphasis: 'primary',
    })

    priorities.push({
      key: 'pace',
      level: 'Priority 2',
      title: isa.needsMoreIsaFunding
        ? `Move sheltered pace toward ${fmtGBPWhole(isa.suggestedMonthlyIsa)}/mo`
        : monthlyIsaValue > 0
          ? 'Keep sheltered pace steady'
          : 'Decide what part of the plan belongs in wrappers',
      amountText:
        isa.needsMoreIsaFunding
          ? `${fmtGBPWhole(isa.suggestedMonthlyIsa)}/mo suggested`
          : monthlyIsaValue > 0
            ? `${fmtGBPWhole(monthlyIsaValue)}/mo currently planned`
            : planPace > 0
              ? `${fmtGBPWhole(planPace)}/mo current plan pace`
              : 'Set a monthly wrapper pace',
      body:
        isa.needsMoreIsaFunding
          ? 'That pace would help you use more of the remaining annual allowance before tax-year end.'
          : monthlyIsaValue > 0
            ? 'Your current monthly wrapper pace looks broadly consistent with this plan.'
            : 'You have a plan pace, but none of it is yet clearly assigned to wrapper funding.',
      watchout:
        'Wrapper funding and total plan funding are not always the same thing.',
      emphasis: 'secondary',
      action:
        isa.needsMoreIsaFunding
          ? {
              type: 'set_isa_monthly',
              label: 'Use suggested ISA pace',
              value: String(isa.suggestedMonthlyIsa || ''),
            }
          : null,
    })
  } else {
    summary =
      'This still looks like a longer-horizon plan, so use long-term tax shelter first, then tighten monthly wrapper pace, then decide how overflow should be handled.'

    priorities.push({
      key: 'stocks_isa',
      level: 'Priority 1',
      title: 'Use Stocks & Shares ISA allowance first',
      amountText:
        remainingAllowance > 0
          ? `${fmtGBPWhole(remainingAllowance)} annual ISA room left`
          : 'Annual ISA allowance already used',
      body:
        'For long-horizon wealth building, this is usually the strongest default wrapper before adding complexity elsewhere.',
      watchout:
        'Less suitable for money you may need in the near term.',
      emphasis: 'primary',
    })

    priorities.push({
      key: 'pace',
      level: 'Priority 2',
      title: isa.needsMoreIsaFunding
        ? `Move sheltered pace toward ${fmtGBPWhole(isa.suggestedMonthlyIsa)}/mo`
        : monthlyIsaValue > 0
          ? 'Keep sheltered pace steady'
          : 'Decide what part of the plan belongs in wrappers',
      amountText:
        isa.needsMoreIsaFunding
          ? `${fmtGBPWhole(isa.suggestedMonthlyIsa)}/mo suggested`
          : monthlyIsaValue > 0
            ? `${fmtGBPWhole(monthlyIsaValue)}/mo currently planned`
            : planPace > 0
              ? `${fmtGBPWhole(planPace)}/mo current plan pace`
              : 'Set a monthly wrapper pace',
      body:
        isa.needsMoreIsaFunding
          ? 'That pace would help you use more of the remaining annual allowance before year-end.'
          : monthlyIsaValue > 0
            ? 'Your current monthly wrapper pace looks broadly aligned with the plan.'
            : 'You have a plan pace, but none of it is clearly designated as wrapper funding yet.',
      watchout:
        'This improves tax efficiency, but it does not replace contribution discipline.',
      emphasis: 'secondary',
      action:
        isa.needsMoreIsaFunding
          ? {
              type: 'set_isa_monthly',
              label: 'Use suggested ISA pace',
              value: String(isa.suggestedMonthlyIsa || ''),
            }
          : null,
    })
  }

  priorities.push({
    key: 'overflow',
    level: priorities.length === 2 ? 'Priority 3' : 'Priority 2',
    title:
      yearsRemaining > 0 && yearsRemaining <= 5
        ? 'Keep overflow accessible'
        : 'Then decide where overflow should go',
    amountText:
      remainingAllowance > 0
        ? 'After wrapper capacity is used'
        : 'Applies now if ISA room is already used',
    body:
      yearsRemaining > 0 && yearsRemaining <= 5
        ? 'Once the core wrapper order is handled, extra money should usually stay liquid and close to the goal.'
        : 'After wrappers are funded, overflow can sit in taxable investing, reserve cash, or another strategic destination depending on the goal.',
    watchout:
      yearsRemaining > 0 && yearsRemaining <= 5
        ? 'Do not let a near-term target drift into risk you do not need.'
        : 'This should follow the plan, not just chase the highest expected return.',
    emphasis: 'secondary',
  })

  return {
    summary,
    priorities: priorities.slice(0, 3),
  }
}