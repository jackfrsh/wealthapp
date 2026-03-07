// frontend/src/pages/Privacy.jsx
import React, { useCallback } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../App'
import Card from '../components/Card'
import { useSEO } from '../useSEO'

export default function Privacy() {
  const { setPage, authed } = useApp()

  useSEO({
    title: 'Privacy — Paddock',
    description:
      'How Paddock handles data: no ads, no tracking cookies, and transparent account security.',
    canonicalPath: '/privacy',
  })

  const handleClose = useCallback(() => {
    try {
      if (window.history.length > 1) {
        window.history.back()
        return
      }
    } catch {}

    setPage(authed ? 'home' : 'landing')
  }, [authed, setPage])

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      <div className="sticky top-0 z-20 bg-white/70 dark:bg-surface-dark/70 backdrop-blur-xl border-b border-black/[.05] dark:border-white/[.06]">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 h-14 flex items-center justify-between">
          <div className="w-10" />
          <div className="text-sm font-semibold text-ink dark:text-white">Privacy</div>
          <button
            type="button"
            onClick={handleClose}
            className="w-10 h-10 grid place-items-center rounded-2xl border border-black/[.06] dark:border-white/[.08] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
            aria-label="Close"
            title="Close"
          >
            <X size={18} className="text-ink dark:text-white" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 sm:px-6 py-8 sm:py-10">
        <Card className="p-7 sm:p-8">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ink dark:text-white">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-ink-muted dark:text-white/60">Last updated: March 2, 2026</p>

          <div className="mt-7 space-y-6 text-sm leading-relaxed text-ink dark:text-white/80">
            <p>
              This policy explains what data we collect, why we collect it, and how we use it when you use this app.
              We aim to collect the minimum needed to run the product.
            </p>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">What we collect</h2>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-ink-muted dark:text-white/60">
                <li>
                  <span className="text-ink dark:text-white/80">Account data:</span> email address and authentication
                  identifiers.
                </li>
                <li>
                  <span className="text-ink dark:text-white/80">Financial entries you add:</span> account names, types,
                  balances, goals, and contributions you input.
                </li>
                <li>
                  <span className="text-ink dark:text-white/80">Usage & diagnostics:</span> basic logs needed to operate
                  and secure the service, for example error logs and performance telemetry.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">What we don’t collect</h2>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-ink-muted dark:text-white/60">
                <li>We do not ask for bank logins or pull data from your bank.</li>
                <li>We do not sell your personal data.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">How we use your data</h2>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-ink-muted dark:text-white/60">
                <li>To provide core app functionality, including dashboards, projections, and totals.</li>
                <li>To secure the service and prevent abuse, including rate-limiting and fraud prevention.</li>
                <li>To improve reliability through debugging and performance monitoring.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Legal basis</h2>
              <p className="mt-2 text-ink-muted dark:text-white/60">
                Where applicable under UK GDPR, we process data to provide the service, to meet legitimate interests
                such as keeping the service secure, and where required, with your consent.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Data storage & processors</h2>
              <p className="mt-2 text-ink-muted dark:text-white/60">
                We use third-party infrastructure providers to host and operate the service, for example authentication
                and hosting. These providers process data only to provide their services to us.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Retention</h2>
              <p className="mt-2 text-ink-muted dark:text-white/60">
                We keep your data for as long as your account is active. If you delete your account, we will delete or
                anonymise your personal data within a reasonable period unless we need to keep certain records for legal
                or security reasons.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Your rights</h2>
              <p className="mt-2 text-ink-muted dark:text-white/60">
                Depending on your location, you may have rights to access, correct, export, or delete your personal data,
                and to object or restrict certain processing.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Contact</h2>
              <p className="mt-2 text-ink-muted dark:text-white/60">
                For privacy questions or requests, contact us at:{' '}
                <span className="text-ink dark:text-white/80">support@yourdomain.com</span>
              </p>
            </section>
          </div>
        </Card>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleClose}
            className="h-11 px-6 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}