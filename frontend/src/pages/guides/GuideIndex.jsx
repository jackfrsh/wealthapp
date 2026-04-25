import React from 'react'
import { GuideShell, GuideLink } from '../../components/GuideLayout'
import { useSEO } from '../../useSEO'
import { usePublicNavigation } from '../public/navigation'

export default function GuideIndex() {
  const { navigateTo } = usePublicNavigation()

  useSEO({
    title: 'Guides — Paddock',
    description:
      'UK-focused planning guides from Paddock, written to explain long-term wealth decisions clearly and calmly.',
    canonicalPath: '/guides',
  })

  return (
    <GuideShell
      title="Guides"
      onBack={() => navigateTo('/')}
      navigateTo={navigateTo}
    >
      <h1 className="guide-h1">Guides for long-term wealth tracking</h1>

      <p className="guide-lead">
        Clear, UK-focused explanations of the decisions that shape long-term wealth. Written to
        be readable, useful, and free of financial-marketing noise.
      </p>
      <p className="mt-[-1.5rem] max-w-[62ch] text-xs leading-6 text-ink-muted/70 dark:text-white/32">
        Manual, private wealth tracking. No bank connection required.
      </p>

      <div className="guide-links" style={{ marginTop: 24 }}>
        <GuideLink to="/guides/how-long-will-my-pension-last" navigateTo={navigateTo}>
          How long will my pension last? 
        </GuideLink>
        <GuideLink to="/best-net-worth-tracking-apps-uk" navigateTo={navigateTo}>
          Best net worth tracking apps UK 
        </GuideLink>
        <GuideLink to="/why-i-track-wealth-manually-instead-of-using-open-banking-apps" navigateTo={navigateTo}>
          Why I track wealth manually instead of using open banking apps 
        </GuideLink>
        <GuideLink to="/guides/multi-currency-net-worth-tracker" navigateTo={navigateTo}>
          Multi-currency net worth tracking explained 
        </GuideLink>
        <GuideLink to="/guides/long-term-wealth-projection" navigateTo={navigateTo}>
          How long-term wealth projections work 
        </GuideLink>
        <GuideLink to="/guides/inflation-adjusted-net-worth" navigateTo={navigateTo}>
          Inflation-adjusted net worth: real terms vs nominal 
        </GuideLink>
      </div>
    </GuideShell>
  )
}
