import React from 'react'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

export default function Toast({ message, type = 'success' }) {
  const icons = { success: CheckCircle2, error: XCircle, warning: AlertCircle }
  const colors = {
    success: 'bg-accent text-white',
    error: 'bg-danger text-white',
    warning: 'bg-amber-500 text-white',
  }
  const Icon = icons[type] || CheckCircle2

  return (
    <div className="fixed bottom-24 lg:bottom-8 right-4 sm:right-6 z-[9999] animate-slide-up">
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-card-lg ${colors[type]} text-sm font-medium`}>
        <Icon size={18} />
        <span>{message}</span>
      </div>
    </div>
  )
}
