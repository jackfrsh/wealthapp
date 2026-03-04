// frontend/src/pages/Security.jsx
import React from 'react'
import { X } from 'lucide-react'
import { useApp } from '../App'
import Card from '../components/Card'
import { useSEO } from '../useSEO'

export default function Security() {
  const { setPage } = useApp()

  useSEO({
    title: 'Security — Paddock',
    description: 'Security at Paddock. We take security seriously and design the app to minimise risk. No bank linking by design.',
    canonicalPath: '/security',
  })

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      {/* Top bar (Apple-style) */}
      <div className="sticky top-0 z-20 bg-white/70 dark:bg-surface-dark/70 backdrop-blur-xl border-b border-black/[.05] dark:border-white/[.06]">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 h-14 flex items-center justify-between">
          <div className="w-10" />
          <div className="text-sm font-semibold text-ink dark:text-white">Security</div>
          <button
            type="button"
            onClick={() => setPage('landing')}
            className="w-10 h-10 grid place-items-center rounded-2xl border border-black/[.06] dark:border-white/[.08] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
            aria-label="Close"
            title="Close"
          >
            <X size={18} className="text-ink dark:text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-5 sm:px-6 py-8 sm:py-10">
        <Card className="p-7 sm:p-8">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ink dark:text-white">
            Security
          </h1>
          <p className="mt-2 text-sm text-ink-muted dark:text-white/60">Last updated: March 2, 2026</p>

          <div className="mt-7 space-y-6 text-sm leading-relaxed text-ink dark:text-white/80">
            <p>
              We take security seriously and design the app to minimise risk. No system is perfect, but we aim to follow
              sensible best practices for an early-stage product.
            </p>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Authentication</h2>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-ink-muted dark:text-white/60">
                <li>Sign-in is handled by Supabase Auth.</li>
                <li>Passwords are not stored in our application code or database in plain text.</li>
                <li>Access to your data is scoped to your account.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Data protection</h2>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-ink-muted dark:text-white/60">
                <li>Traffic is encrypted in transit (HTTPS).</li>
                <li>We follow least-privilege principles for database access.</li>
                <li>We use rate limiting and monitoring to reduce abuse and credential stuffing.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">What you can do</h2>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-ink-muted dark:text-white/60">
                <li>Use a strong, unique password.</li>
                <li>Don’t share your login details.</li>
                <li>Report anything suspicious so we can investigate quickly.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-ink dark:text-white">Reporting a vulnerability</h2>
              <p className="mt-2 text-ink-muted dark:text-white/60">
                If you believe you’ve found a security issue, email:{' '}
                <span className="text-ink dark:text-white/80">security@yourdomain.com</span>. Please include steps to
                reproduce and we’ll respond as soon as possible.
              </p>
            </section>
          </div>
        </Card>

        {/* Bottom close (nice on mobile) */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setPage('landing')}
            className="h-11 px-6 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}