// frontend/src/apiCache.js
/**
 * In-memory API response cache with per-path TTL.
 *
 * Makes navigation feel instant: switching Home → Outlook → Home
 * shows cached data immediately while fresh data loads behind.
 *
 * Cache is invalidated by calling `invalidateCache()` (wired to bumpData).
 */

const _cache = new Map()

const PATH_TTL = {
  '/settings':          120_000,  // 2 min — rarely changes
  '/accounts':           30_000,  // 30s
  '/goals/primary':      30_000,
  '/dashboard':          15_000,  // 15s — the hero number, worth re-checking
  '/insights':           30_000,
}

function ttlForPath(path) {
  // Exact match first
  if (PATH_TTL[path]) return PATH_TTL[path]
  // Prefix match (e.g. /dashboard?range=3M matches /dashboard)
  for (const [prefix, ttl] of Object.entries(PATH_TTL)) {
    if (path.startsWith(prefix)) return ttl
  }
  // Default: 10s for any GET
  return 10_000
}

/**
 * Get a cached response if fresh enough.
 * @returns {any|null} Cached data or null
 */
export function getCached(path) {
  const entry = _cache.get(path)
  if (!entry) return null

  const age = Date.now() - entry.ts
  if (age > ttlForPath(path)) {
    _cache.delete(path)
    return null
  }

  return entry.data
}

/**
 * Store a response in cache.
 */
export function setCache(path, data) {
  _cache.set(path, { data, ts: Date.now() })
}

/**
 * Invalidate all cached data (call on bumpData / mutations).
 */
export function invalidateCache() {
  _cache.clear()
}

/**
 * Invalidate specific path(s).
 * Cache keys are scoped as "scope:path", so we extract the path portion for matching.
 */
export function invalidatePath(...paths) {
  for (const p of paths) {
    // Delete exact and any query-string variants
    for (const key of _cache.keys()) {
      // Extract the path portion after the scope prefix (e.g. "user123:/dashboard" → "/dashboard")
      const colonIdx = key.indexOf(':')
      const keyPath = colonIdx !== -1 ? key.slice(colonIdx + 1) : key
      if (keyPath === p || keyPath.startsWith(p + '?') || keyPath.startsWith(p + '/')) {
        _cache.delete(key)
      }
    }
  }
}
