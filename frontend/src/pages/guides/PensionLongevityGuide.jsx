import React from 'react'
import {
  GuideShell,
  H2,
  P,
  UL,
  Callout,
  Example,
  GuideCTA,
} from '../../components/GuideLayout'
import { useSEO } from '../../useSEO'
import { usePublicNavigation } from '../public/navigation'

export default function PensionLongevityGuide() {
  const { navigateTo, openPaddock } = usePublicNavigation()

  useSEO({
    title: 'How Long Will My Pension Last? — Paddock',
    description:
      'A calm, UK-focused guide to pension drawdown, investment returns, inflation, and the risks that affect how long a pension may last.',
    canonicalPath: '/guides/how-long-will-my-pension-last',
  })

  return (
    <GuideShell
      title="Guide"
      onBack={() => navigateTo('/guides')}
      navigateTo={navigateTo}
    >
      <div className="guide-kicker">UK pension guide</div>
      <h1 className="guide-h1">How long will my pension last?</h1>
      <p className="guide-lead">
        For most people, the real question is not just how big the pension pot is. It is how
        long that pot can keep supporting the life you want once work income stops.
      </p>

      <H2>Pension drawdown, in plain English</H2>
      <P>
        In drawdown, your pension stays invested while you take money out over time. Instead of
        buying a guaranteed income for life, you keep control of the pot and choose how much to
        withdraw.
      </P>
      <P>
        That flexibility is useful, but it also means the outcome depends on a few moving parts:
        how much is in the pension when you retire, how much you withdraw each year, and how the
        investments behave after charges and inflation.
      </P>

      <H2>What usually determines how long a pension lasts</H2>
      <UL>
        <li>The size of your pension pot when you begin drawdown.</li>
        <li>The income you want the pot to provide each year.</li>
        <li>The investment return the pot earns after retirement.</li>
        <li>How long you expect the money to support you, and possibly a partner.</li>
      </UL>

      <P>
        A larger pot does help, but withdrawal rate is often the bigger lever. Taking £20,000 a
        year from a £500,000 pot is very different from taking £20,000 a year from a £250,000
        pot, even if both portfolios earn the same return.
      </P>

      <H2>Returns matter, but they are never smooth</H2>
      <P>
        Many retirement illustrations use one average return assumption, such as 4% or 5% a
        year. That is useful for planning, but reality does not arrive in a straight line. Some
        years will be stronger, some weaker, and markets can fall just when you start taking
        income.
      </P>

      <Callout>
        A pension can last much longer when withdrawals are modest relative to the pot and the
        underlying investments keep compounding after retirement.
      </Callout>

      <GuideCTA
        onClick={openPaddock}
        buttonText="Model your pension and track it over time with Paddock"
      >
        Model your pension and track it over time with Paddock
      </GuideCTA>

      <H2>Inflation quietly changes the picture</H2>
      <P>
        A retirement income target that feels comfortable today may need to rise over time just
        to preserve the same standard of living. In the UK, even moderate inflation can compound
        into a meaningful difference over a twenty or thirty year retirement.
      </P>
      <P>
        If you plan to withdraw a flat cash amount forever, the pot may last longer on paper, but
        the income could buy less each year. If you increase withdrawals to keep pace with
        inflation, the pot may run down faster. Neither assumption is wrong, but it helps to be
        explicit about which version you are modelling.
      </P>

      <H2>Sequence risk is simple, even if the name sounds technical</H2>
      <P>
        Sequence risk means poor investment returns early in retirement can do more damage than
        poor returns later on. That is because withdrawals from a falling pot leave less capital
        behind to recover when markets improve.
      </P>
      <P>
        You do not need complex jargon to use this idea well. The practical takeaway is that the
        first few years of drawdown deserve extra care, especially if the withdrawal level is
        ambitious.
      </P>

      <Example>
        Two retirees might earn the same average return over fifteen years. If one suffers the
        worst declines in the first few years while taking income, their pension can run down much
        faster than the person whose weaker years arrive later.
      </Example>

      <H2>How to think about a realistic drawdown plan</H2>
      <UL>
        <li>Start with a sensible income target, not just the highest number the pot can support today.</li>
        <li>Stress-test the plan against lower returns or a slightly earlier retirement.</li>
        <li>Review the plan over time instead of setting it once and forgetting it.</li>
        <li>Keep fees, tax, and inflation in view alongside headline returns.</li>
      </UL>

      <H2>A calm way to use these numbers</H2>
      <P>
        A pension calculator should not be treated as a promise. Its job is to help you see the
        shape of the decision: whether you are broadly on track, where the pressure points are,
        and which assumptions deserve another look.
      </P>
      <P>
        That is usually enough to make better decisions. Small changes to contributions,
        retirement timing, or planned spending can meaningfully improve the odds of the pension
        lasting longer.
      </P>

      <GuideCTA
        onClick={openPaddock}
        buttonText="Model your pension and track it over time with Paddock"
      >
        Model your pension and track it over time with Paddock
      </GuideCTA>
    </GuideShell>
  )
}
