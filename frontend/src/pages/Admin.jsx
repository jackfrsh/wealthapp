import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import { RefreshCw, Lock } from 'lucide-react'

function pct(n, d) {
  if (!d) return '—'
  const v = (Number(n) / Number(d)) * 100
  if (!Number.isFinite(v)) return '—'
  return `${v.toFixed(0)}%`
}

function fmtDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return '—'
  }
}

function metricValue(loading, value, fallback = '—') {
  if (loading) return '—'
  return value ?? fallback
}

export default function Admin() {
  const { api, showToast, setPage } = useApp()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setForbidden(false)

    try {
      const r = await api('/admin/metrics?days=14', { skipCache: true })
      setData(r)
    } catch (e) {
      if (e?.status === 403) {
        setForbidden(true)
        setData(null)
      } else {
        showToast(e?.message || 'Failed to load admin metrics', 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [api, showToast])

  useEffect(() => {
    load()
  }, [load])

  const totals = data?.totals || {}
  const funnel = data?.funnel_distinct_users || {}
  const pages = Array.isArray(data?.pages) ? data.pages : []
  const users = Array.isArray(data?.users) ? data.users : []
  const events = Array.isArray(data?.events) ? data.events : []

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
      <div className="flex items-center justify-between gap-3">
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
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-xs text-ink-muted dark:text-white/50">Total users</div>
          <div className="mt-2 text-3xl font-semibold">
            {metricValue(loading, totals.users)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-muted dark:text-white/50">Pro users</div>
          <div className="mt-2 text-3xl font-semibold">
            {metricValue(loading, totals.pro_users)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-muted dark:text-white/50">Active users</div>
          <div className="mt-2 text-3xl font-semibold">
            {metricValue(loading, totals.active_users)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-muted dark:text-white/50">Users with accounts</div>
          <div className="mt-2 text-3xl font-semibold">
            {metricValue(loading, totals.users_with_accounts)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-muted dark:text-white/50">Users with goals</div>
          <div className="mt-2 text-3xl font-semibold">
            {metricValue(loading, totals.users_with_goals)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-ink-muted dark:text-white/50">Avg accounts / funded user</div>
          <div className="mt-2 text-3xl font-semibold">
            {metricValue(loading, totals.avg_accounts_per_user)}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 text-sm">
          {Object.entries(funnel).map(([k, v]) => (
            <div
              key={k}
              className="rounded-xl border border-black/10 dark:border-white/10 p-3"
            >
              <div className="text-xs text-ink-muted dark:text-white/50">{k}</div>
              <div className="mt-1 text-lg font-semibold">{loading ? '—' : v}</div>
            </div>
          ))}

          {!loading && Object.keys(funnel).length === 0 && (
            <div className="text-ink-muted dark:text-white/50">No funnel data yet.</div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">Top pages</div>

          <div className="space-y-2 text-sm">
            {pages.map((row) => (
              <div
                key={row.page}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{row.page || 'unknown'}</div>
                  <div className="text-xs text-ink-muted dark:text-white/50">
                    {row.unique_users ?? 0} unique users
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-semibold">{row.views ?? 0}</div>
                  <div className="text-xs text-ink-muted dark:text-white/50">views</div>
                </div>
              </div>
            ))}

            {!loading && pages.length === 0 && (
              <div className="text-ink-muted dark:text-white/50">No page views yet.</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">Events (count)</div>

          <div className="space-y-2 text-sm">
            {events.map((e) => (
              <div key={e.name} className="flex items-center justify-between gap-3">
                <span className="text-ink-muted dark:text-white/70 truncate">{e.name}</span>
                <span className="font-semibold">{e.count}</span>
              </div>
            ))}

            {!loading && events.length === 0 && (
              <div className="text-ink-muted dark:text-white/50">No events yet.</div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-sm font-semibold">Users</div>
          <div className="text-xs text-ink-muted dark:text-white/50">
            Most recently active first
          </div>
        </div>

        {!loading && users.length === 0 ? (
          <div className="text-sm text-ink-muted dark:text-white/50">
            No user analytics yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-left text-ink-muted dark:text-white/50 border-b border-black/10 dark:border-white/10">
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Joined</th>
                  <th className="py-2 pr-4 font-medium">Last active</th>
                  <th className="py-2 pr-4 font-medium">Accounts</th>
                  <th className="py-2 pr-4 font-medium">Goal</th>
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 pr-4 font-medium">Page views</th>
                  <th className="py-2 pr-4 font-medium">Checkout</th>
                  <th className="py-2 font-medium">Converted</th>
                </tr>
              </thead>

              <tbody>
                {(loading ? Array.from({ length: 6 }) : users).map((u, idx) => (
                  <tr
                    key={loading ? `skeleton-${idx}` : u.user_id}
                    className="border-b border-black/5 dark:border-white/5"
                  >
                    <td className="py-3 pr-4">
                      {loading ? (
                        <span className="text-ink-muted dark:text-white/30">—</span>
                      ) : (
                        <div>
                          <div className="font-medium">{u.email || '—'}</div>
                          <div className="text-xs text-ink-muted dark:text-white/50">
                            id {u.user_id}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="py-3 pr-4 text-ink-muted dark:text-white/70">
                      {loading ? '—' : fmtDateTime(u.created_at)}
                    </td>

                    <td className="py-3 pr-4 text-ink-muted dark:text-white/70">
                      {loading ? '—' : fmtDateTime(u.last_active_at)}
                    </td>

                    <td className="py-3 pr-4">{loading ? '—' : u.account_count ?? 0}</td>

                    <td className="py-3 pr-4">{loading ? '—' : u.has_goal ? 'Yes' : 'No'}</td>

                    <td className="py-3 pr-4">{loading ? '—' : u.is_pro ? 'Pro' : 'Free'}</td>

                    <td className="py-3 pr-4">{loading ? '—' : u.page_views ?? 0}</td>

                    <td className="py-3 pr-4">
                      {loading ? '—' : u.checkout_started ? 'Started' : '—'}
                    </td>

                    <td className="py-3">{loading ? '—' : u.converted ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}