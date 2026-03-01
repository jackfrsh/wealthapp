import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import { RefreshCw, Lock } from 'lucide-react'

function pct(n, d) {
  if (!d) return '—'
  const v = (Number(n) / Number(d)) * 100
  if (!Number.isFinite(v)) return '—'
  return `${v.toFixed(0)}%`
}

export default function Admin() {
  const { api, showToast, setPage } = useApp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const load = async () => {
    setLoading(true)
    setForbidden(false)
    try {
      const r = await api('/admin/metrics?days=14')
      setData(r)
    } catch (e) {
      // api.js now should NOT logout on 403 (we patched it)
      if (e?.status === 403) {
        setForbidden(true)
      } else {
        showToast(e?.message || 'Failed to load admin metrics', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const funnel = data?.funnel_distinct_users || {}
  const signup = funnel.signup || 0
  const activated = funnel.projection_opened || 0
  const upgraded = funnel.upgrade_success || 0

  const activationRate = useMemo(() => pct(activated, signup), [activated, signup])
  const upgradeRate = useMemo(() => pct(upgraded, signup), [upgraded, signup])

  if (forbidden) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-ink-muted dark:text-white/50">
            You don’t have access to this page.
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Lock size={18} className="text-ink-muted dark:text-white/50" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Admin only</div>
              <div className="mt-1 text-sm text-ink-muted dark:text-white/60">
                Ask the owner to add your email to the admin allowlist.
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setPage?.('home')}
                  className="px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                  type="button"
                >
                  Back to Home
                </button>
                <button
                  onClick={load}
                  className="px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                  type="button"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-ink-muted dark:text-white/50">
            Metrics (last {data?.range_days ?? 14} days)
          </p>
        </div>

        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
          type="button"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-xs text-ink-muted dark:text-white/50">Total users</div>
          <div className="mt-2 text-3xl font-semibold">
            {loading ? '—' : data?.totals?.users ?? '—'}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-muted dark:text-white/50">Pro users</div>
          <div className="mt-2 text-3xl font-semibold">
            {loading ? '—' : data?.totals?.pro_users ?? '—'}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-xs text-ink-muted dark:text-white/50">Activation</div>
          <div className="mt-2 text-3xl font-semibold">{loading ? '—' : activationRate}</div>
          <div className="mt-2 text-xs text-ink-muted dark:text-white/50">
            projection_opened / signup
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-muted dark:text-white/50">Upgrade rate</div>
          <div className="mt-2 text-3xl font-semibold">{loading ? '—' : upgradeRate}</div>
          <div className="mt-2 text-xs text-ink-muted dark:text-white/50">
            upgrade_success / signup
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold mb-3">Funnel (distinct users)</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {Object.entries(funnel).map(([k, v]) => (
            <div
              key={k}
              className="rounded-xl border border-black/10 dark:border-white/10 p-3"
            >
              <div className="text-xs text-ink-muted dark:text-white/50">{k}</div>
              <div className="mt-1 text-lg font-semibold">{loading ? '—' : v}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-semibold mb-3">Events (count)</div>
        <div className="space-y-2 text-sm">
          {(data?.events || []).map((e) => (
            <div key={e.name} className="flex items-center justify-between">
              <span className="text-ink-muted dark:text-white/70">{e.name}</span>
              <span className="font-semibold">{e.count}</span>
            </div>
          ))}
          {!loading && (!data?.events || data.events.length === 0) && (
            <div className="text-ink-muted dark:text-white/50">No events yet.</div>
          )}
        </div>
      </Card>
    </div>
  )
}