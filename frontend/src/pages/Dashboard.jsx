import React, { useEffect, useState } from "react";
import { apiGet } from "../api";
import { useAuth } from "../auth/AuthProvider";

export default function DashboardPage() {
  const { signOut } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;

    apiGet("/dashboard?range=1M")
      .then((d) => {
        if (!alive) return;
        setData(d);
        setErr(null);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || String(e));
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
          Dashboard
        </h1>

        <button
          onClick={() => signOut()}
          className="px-4 py-2 rounded-2xl bg-surface-2 dark:bg-white/5 text-sm font-semibold text-ink dark:text-white hover:opacity-90"
        >
          Sign out
        </button>
      </div>

      {err && (
        <div className="mt-4 text-sm text-danger bg-danger-light dark:bg-danger/10 px-4 py-3 rounded-2xl">
          {err}
        </div>
      )}

      {!err && !data && (
        <div className="mt-5 text-sm text-ink-muted dark:text-white/35">
          Loading dashboard…
        </div>
      )}

      {data && (
        <div className="mt-6 grid gap-3 text-sm text-ink dark:text-white">
          <div>Base: {data.base_currency}</div>
          <div>Current total: {data.current_total}</div>
          <div>
            Since last snapshot: {data.change_since_snapshot} ({data.change_since_snapshot_pct}%)
          </div>
          <div>
            Range change: {data.range_change} ({data.range_change_pct}%)
          </div>
          <div>
            Accounts: {data.accounts_count} (excluded: {data.excluded_accounts})
          </div>
          <div>Snapshots: {data.total_snapshots}</div>
          <div>FX as of: {data.fx_as_of}</div>
        </div>
      )}
    </div>
  );
}
