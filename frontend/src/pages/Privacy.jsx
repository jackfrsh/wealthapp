import React from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import { ArrowLeft } from 'lucide-react'

export default function Privacy({ onBack }) {
  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      <div className="max-w-[640px] mx-auto px-6 sm:px-10 py-12 sm:py-20">
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={onBack}
          className="mb-8"
        >
          Back
        </Button>

        <h1 className="text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
          Privacy
        </h1>
        <p className="mt-3 text-base text-ink-muted dark:text-white/40 leading-relaxed">
          Your financial data is yours. Here's how we handle it.
        </p>

        <Card className="mt-8">
          <div className="space-y-4">
            {[
              'We never sell, share, or monetise your data.',
              'No advertising — ever.',
              'Your data is encrypted in transit using TLS.',
              'We do not track you across other websites.',
              'We store the minimum data required to run the service.',
              'Account deletion removes your data permanently.',
              'We do not use your data to train models.',
              'No third-party analytics or tracking pixels.',
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 text-sm text-ink dark:text-white/70"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
