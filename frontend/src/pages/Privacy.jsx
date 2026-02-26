// frontend/src/pages/Privacy.jsx
import React from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import { ArrowLeft } from 'lucide-react'

export default function Privacy() {
  const { setPage } = useApp()

  const goBack = () => {
    try {
      if (window.history.length > 1) window.history.back()
      else setPage('landing', { replace: true })
    } catch {
      setPage('landing', { replace: true })
    }
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted dark:text-white/40 hover:text-ink dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <Card className="p-8">
          <h1 className="font-display text-3xl text-ink dark:text-white tracking-tight">
            Privacy
          </h1>
          <p className="mt-3 text-sm text-ink-muted dark:text-white/40 leading-relaxed">
            Paddock is built to be calm and private: no ads, no tracker pixels, no selling data.
          </p>

          <div className="mt-6 space-y-3 text-sm text-ink-muted dark:text-white/40 leading-relaxed">
            <p>
              We collect only what’s needed to run the product (account access, settings, and your
              wealth data you enter).
            </p>
            <p>
              You can delete your account at any time. Data is encrypted in transit.
            </p>
            <p>
              This page is a placeholder — replace with your formal privacy policy copy before launch.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}