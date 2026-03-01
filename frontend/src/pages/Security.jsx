// frontend/src/pages/Security.jsx
import React from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import { ArrowLeft, Shield } from 'lucide-react'

export default function Security() {
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
          <div className="flex items-center gap-2">
            <Shield size={18} className="opacity-80" />
            <h1 className="font-display text-3xl text-ink dark:text-white tracking-tight">
              Security
            </h1>
          </div>

          <p className="mt-3 text-sm text-ink-muted dark:text-white/40 leading-relaxed">
            Secure authentication, encrypted transport, and disciplined product design.
          </p>

          <div className="mt-6 space-y-3 text-sm text-ink-muted dark:text-white/40 leading-relaxed">
            <p>
              Authentication is handled by Supabase. Sessions expire and are revalidated automatically.
            </p>
            <p>
              This page is a placeholder — replace with your formal security statements before launch.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}