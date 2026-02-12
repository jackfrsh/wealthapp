import React, { useState } from 'react'
import { api } from '../api'
import { useApp } from '../App'

export default function AuthPage({ onLogin }) {
  const { dark, showToast } = useApp()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError('')
    if (!username.trim() || !password) {
      setError('Please enter username and password')
      return
    }
    setLoading(true)
    try {
      if (mode === 'register') {
        await api('/auth/register', { method: 'POST', body: { username: username.trim(), password } })
        showToast('Account created!')
      }
      const data = await api('/auth/login', { method: 'POST', body: { username: username.trim(), password } })
      onLogin(data.access_token, username.trim())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-surface-dark p-4">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-accent/5 dark:bg-accent/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-amber-500/5 dark:bg-amber-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-ink dark:text-white tracking-tight">
            wealth<span className="text-accent">.</span>
          </h1>
          <p className="text-sm text-ink-muted dark:text-white/40 mt-1">Track your net worth, beautifully.</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-surface-dark-2 rounded-3xl shadow-card border border-black/[.04] dark:border-white/[.06] p-8">
          {/* Tabs */}
          <div className="flex border-b border-black/[.06] dark:border-white/[.06] mb-6">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                  mode === m
                    ? 'text-ink dark:text-white border-ink dark:border-white'
                    : 'text-ink-muted dark:text-white/40 border-transparent hover:text-ink dark:hover:text-white/70'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-danger bg-danger-light dark:bg-danger/10 px-4 py-2.5 rounded-xl mb-4 animate-fade-in">
              {error}
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-3 dark:text-white/60 mb-1.5 tracking-wide">Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full px-4 py-2.5 rounded-xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-ink dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                placeholder="yourname"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-3 dark:text-white/60 mb-1.5 tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full px-4 py-2.5 rounded-xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-ink dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-ink dark:bg-white text-white dark:text-ink font-semibold text-sm transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-50"
            >
              {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
