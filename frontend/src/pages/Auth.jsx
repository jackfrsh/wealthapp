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
    <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-surface-dark p-5">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-accent/[.04] dark:bg-accent/[.06] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-amber-500/[.04] dark:bg-amber-500/[.04] rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl text-ink dark:text-white tracking-tight">
            wealth<span className="text-accent">.</span>
          </h1>
          <p className="text-sm text-ink-muted dark:text-white/35 mt-2">Plan your financial future, beautifully.</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-surface-dark-2 rounded-3xl shadow-card-lg border border-black/[.05] dark:border-white/[.06] p-8 sm:p-10">
          {/* Tabs */}
          <div className="flex border-b border-black/[.06] dark:border-white/[.06] mb-7">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`pb-3.5 px-5 text-sm font-semibold border-b-2 transition-colors -mb-px min-h-[44px] ${
                  mode === m
                    ? 'text-ink dark:text-white border-ink dark:border-white'
                    : 'text-ink-muted dark:text-white/35 border-transparent hover:text-ink dark:hover:text-white/60'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-danger bg-danger-light dark:bg-danger/10 px-4 py-3 rounded-2xl mb-5 animate-fade-in">
              {error}
            </div>
          )}

          {/* Form */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-wide">Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-ink dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                placeholder="yourname"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-wide">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-dark text-ink dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-accent text-white font-semibold text-base transition-all hover:bg-accent-dark active:scale-[.98] disabled:opacity-50 min-h-[48px]"
            >
              {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
