import React from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import { ArrowLeft } from 'lucide-react'

export default function Security({ onBack }) {
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
          Security
        </h1>
        <p className="mt-3 text-base text-ink-muted dark:text-white/40 leading-relaxed">
          How we keep your account and data safe.
        </p>

        <Card className="mt-8">
          <div className="space-y-4">
            {[
              'Authentication is handled by Supabase Auth with secure session management.',
              'All connections are encrypted with TLS in transit.',
              'Passwords are hashed — we never store them in plain text.',
              'Sessions expire automatically after inactivity.',
              'You can reset your password at any time via email.',
              'Account deletion is permanent and irreversible.',
              'We regularly review dependencies for known vulnerabilities.',
              'Infrastructure is hosted on Railway with managed security.',
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
