import { getCached, setCache, invalidateCache, invalidatePath } from './apiCache'

export { invalidateCache, invalidatePath }
export const SESSION_EXPIRED_EVENT = 'session-expired'

// Default request timeout (ms) — prevents indefinite hangs
const REQUEST_TIMEOUT_MS = 15_000

// ---- Config ----
// Priority:
// 1) Explicit env override (VITE_API_URL)
// 2) Auto: local dev -> http://127.0.0.1:8000/api
//          deployed  -> /api (same-origin)
const envBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')

const isLocalHost = (() => {
  try {
    const h = window.location.hostname
    return h === 'localhost' || h === '127.0.0.1'
  } catch {
    return false
  }
})()

const API_BASE = envBase || (isLocalHost ? 'http://127.0.0.1:8000/api' : '/api')

// Token provider is injectable (Supabase-ready).
let accessTokenProvider = async () => null

export function setAccessTokenProvider(fn) {
  accessTokenProvider = typeof fn === 'function' ? fn : async () => null
  cachedToken = null
  cachedAt = 0
  tokenInFlight = null
}

// Optional legacy helpers
export function getToken() {
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}
export function setToken(token) {
  try {
    localStorage.setItem('access_token', token)
  } catch {}
}
export function clearToken() {
  try {
    localStorage.removeItem('access_token')
  } catch {}
}

function isPlainObject(x) {
  return Object.prototype.toString.call(x) === '[object Object]'
}

async function readBody(res) {
  const ct = res.headers.get('content-type') || ''
  if (res.status === 204) return null
  if (ct.includes('application/json')) {
    try {
      return await res.json()
    } catch {
      return null
    }
  }
  try {
    return await res.text()
  } catch {
    return null
  }
}

function makeError(res, data) {
  const err = new Error()
  err.status = res.status

  const detail =
    (data && typeof data === 'object' && (data.detail ?? data.message)) || null

  err.detail = detail
  err.data = data

  if (typeof detail === 'string') err.message = detail
  else if (Array.isArray(detail))
    err.message = detail.map((d) => d?.msg || String(d)).join(', ')
  else if (typeof data === 'string' && data) err.message = data
  else err.message = `Request failed (${res.status})`

  return err
}

/* ─────────────────────────────────────────────
   Access token caching + de-dupe
───────────────────────────────────────────── */

let cachedToken = null
let cachedAt = 0
let tokenInFlight = null

const TOKEN_TTL_MS = 15_000

async function getAccessTokenCached() {
  const now = Date.now()

  if (cachedToken && now - cachedAt < TOKEN_TTL_MS) return cachedToken
  if (tokenInFlight) return tokenInFlight

  tokenInFlight = (async () => {
    let t = null
    try {
      t = await accessTokenProvider()
    } catch {
      t = null
    }

    if (!t) t = getToken()

    cachedToken = t || null
    cachedAt = Date.now()

    return cachedToken
  })()

  try {
    return await tokenInFlight
  } finally {
    tokenInFlight = null
  }
}

/* ─────────────────────────────────────────────
   401 debounce (avoid multiple logout cascades)
───────────────────────────────────────────── */

let last401At = 0
function dispatchSessionExpiredOnce() {
  const now = Date.now()
  if (now - last401At < 1500) return
  last401At = now
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

/**
 * The ONLY fetch function you should use.
 *
 * GET requests are cached in-memory with per-path TTL.
 * All requests have a 15s timeout via AbortController.
 *
 * Apple-level: Expected outcomes are modeled explicitly:
 * - options.nullOn404: return null (instead of throwing) on 404
 * - options.okStatuses: array of extra HTTP statuses to treat as OK
 */
export async function api(path, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body = undefined,
    signal,
    skipCache = false,

    // ✅ Apple-ish “expected outcomes”
    nullOn404 = false,
    okStatuses = [],
  } = options

  const url =
    path.startsWith('http')
      ? path
      : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`

  const isGet = method.toUpperCase() === 'GET'
  if (isGet && !skipCache) {
    const cached = getCached(path)
    if (cached !== null) return cached
  }

  const token = await getAccessTokenCached()
  const finalHeaders = new Headers(headers)
  let finalBody = body

  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob
  const isString = typeof body === 'string'

  if (body != null && !isFormData && !isBlob) {
    if (!isString && (isPlainObject(body) || Array.isArray(body))) {
      finalBody = JSON.stringify(body)
      if (!finalHeaders.has('Content-Type')) {
        finalHeaders.set('Content-Type', 'application/json')
      }
    } else if (isString) {
      if (!finalHeaders.has('Content-Type')) {
        const t = body.trim()
        if (t.startsWith('{') || t.startsWith('[')) {
          finalHeaders.set('Content-Type', 'application/json')
        }
      }
    }
  }

  if (token && !finalHeaders.has('Authorization')) {
    finalHeaders.set('Authorization', `Bearer ${token}`)
  }

  // ── Timeout: AbortController wrapping any user-provided signal ──
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let res
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: finalBody,
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timeoutId)
    if (e?.name === 'AbortError' && !signal?.aborted) {
      const err = new Error('Request timed out')
      err.status = 0
      err.detail = 'The server took too long to respond. Please try again.'
      throw err
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }

  // ✅ Handle “expected 404 means empty state”
  if (res.status === 404 && nullOn404) {
    // do not cache “not found” unless you intentionally want to
    return null
  }

  const data = await readBody(res)

  // ✅ Allow extra “OK-like” statuses
  const okish = res.ok || (Array.isArray(okStatuses) && okStatuses.includes(res.status))
  if (!okish) {
    if (res.status === 401) {
      // Force token refresh + retry once before declaring session expired.
      cachedToken = null
      cachedAt = 0

      const hadToken = !!token

      try {
        const retryToken = await getAccessTokenCached()
        const retryHeaders = new Headers(finalHeaders)

        if (retryToken) retryHeaders.set('Authorization', `Bearer ${retryToken}`)
        else retryHeaders.delete('Authorization')

        const retryRes = await fetch(url, {
          method,
          headers: retryHeaders,
          body: finalBody,
          signal: controller.signal, // ✅ match our abort behavior
        })

        // Handle expected 404 on retry too
        if (retryRes.status === 404 && nullOn404) return null

        const retryData = await readBody(retryRes)
        const retryOkish =
          retryRes.ok ||
          (Array.isArray(okStatuses) && okStatuses.includes(retryRes.status))

        if (retryOkish) {
          if (isGet) setCache(path, retryData)
          return retryData
        }

        if (retryRes.status === 401 && (hadToken || retryToken)) {
          dispatchSessionExpiredOnce()
        }

        throw makeError(retryRes, retryData)
      } catch (e) {
        // Network errors etc. shouldn't force logout
        throw e
      }
    }

    // ✅ 403 is forbidden (e.g. role/RLS/admin). Do NOT logout.
    throw makeError(res, data)
  }

  if (isGet) setCache(path, data)
  return data
}

// Optional small wrappers
export const apiGet = (path, opts) => api(path, { ...opts, method: 'GET' })
export const apiPost = (path, body, opts) => api(path, { ...opts, method: 'POST', body })
export const apiPut = (path, body, opts) => api(path, { ...opts, method: 'PUT', body })
export const apiPatch = (path, body, opts) => api(path, { ...opts, method: 'PATCH', body })
export const apiDelete = (path, opts) => api(path, { ...opts, method: 'DELETE' })