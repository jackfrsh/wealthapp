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
    <div className="fixed bottom-6 right-6 z-[9999] animate-slide-up">
      <div className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-lg ${colors[type]} text-sm font-medium`}>
        <Icon size={16} />
        <span>{message}</span>
      </div>
    </div>
  )
}
