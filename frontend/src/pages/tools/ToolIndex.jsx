import React from 'react'
import { PublicShell, GuideLink } from '../../components/GuideLayout'
import { useSEO } from '../../useSEO'
import { usePublicNavigation } from '../public/navigation'

export default function ToolIndex() {
  const { navigateTo } = usePublicNavigation()

  useSEO({
    title: 'Tools — Paddock',
    description:
      'Free UK planning tools from Paddock for pensions, FIRE, ISA growth, and net worth.',
    canonicalPath: '/tools',
  })

  return (
    <PublicShell
      title="Tools"
      onBack={() => navigateTo('/')}
      navigateTo={navigateTo}
      backLabel="Back to Paddock"
      layout="tool"
    >
      <div className="guide-kicker">Planning tools</div>
      <h1 className="guide-h1">Free UK wealth tools</h1>
      <p className="guide-lead">
        Calm calculators for pension drawdown, retirement income, ISA growth, and net worth.
        Built for quick understanding, not spreadsheet work.
      </p>
      <p className="mt-[-1.5rem] max-w-[62ch] text-xs leading-6 text-ink-muted/70 dark:text-white/32">
        Manual, private wealth tracking. No bank connection required.
      </p>

      <div className="guide-links" style={{ marginTop: 24 }}>
        <GuideLink to="/tools/pension-drawdown-calculator" navigateTo={navigateTo}>
          Pension Drawdown Calculator UK 
        </GuideLink>
        <GuideLink to="/tools/fire-number-calculator" navigateTo={navigateTo}>
          FIRE Number Calculator UK 
        </GuideLink>
        <GuideLink to="/tools/isa-growth-calculator" navigateTo={navigateTo}>
          ISA Growth Calculator UK 
        </GuideLink>
        <GuideLink to="/tools/net-worth-calculator" navigateTo={navigateTo}>
          Net Worth Calculator UK 
        </GuideLink>
      </div>
    </PublicShell>
  )
}
