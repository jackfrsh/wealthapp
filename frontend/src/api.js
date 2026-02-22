// api.js
export const SESSION_EXPIRED_EVENT = 'session-expired'

// ---- Config ----
// Priority:
// 1) Explicit env override (VITE_API_URL)
// 2) Auto: local dev -> http://127.0.0.1:8000/api
//          deployed  -> /api (same-origin, no CORS, no mixed content)
const envBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')

const isLocalHost = (() => {
  try {
    const h = window.location.hostname
    return h === 'localhost' || h === '127.0.0.1'
  } catch {
    return false
  }
})()

const API_BASE =
  envBase || (isLocalHost ? 'http://127.0.0.1:8000/api' : '/api')

// Token provider is injectable (Supabase-ready).
// In App.jsx (or bootstrap), call setAccessTokenProvider(async () => session?.access_token || null).
let accessTokenProvider = async () => null

export function setAccessTokenProvider(fn) {
  accessTokenProvider = typeof fn === 'function' ? fn : async () => null
}

// Optional legacy helpers (safe to keep; can delete once you're fully Supabase-only)
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

  // FastAPI often returns: { detail: ... }
  const detail =
    (data && typeof data === 'object' && (data.detail ?? data.message)) || null

  err.detail = detail
  err.data = data

  // Human message
  if (typeof detail === 'string') err.message = detail
  else if (Array.isArray(detail))
    err.message = detail.map((d) => d?.msg || String(d)).join(', ')
  else if (typeof data === 'string' && data) err.message = data
  else err.message = `Request failed (${res.status})`

  return err
}

/**
 * The ONLY fetch function you should use.
 * Usage:
 *   api('/goals/primary')
 *   api('/goals', { method: 'POST', body: { ... } })  // body can be object (auto JSON)
 */
export async function api(path, options = {}) {
  const { method = 'GET', headers = {}, body = undefined, signal } = options

  const url =
    path.startsWith('http')
      ? path
      : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`

  // Resolve access token (Supabase or injected provider)
  let token = null
  try {
    token = await accessTokenProvider()
  } catch {
    token = null
  }
  // Legacy fallback (optional)
  if (!token) token = getToken()

  const finalHeaders = new Headers(headers)

  // Prepare body
  let finalBody = body

  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob
  const isString = typeof body === 'string'

  if (body != null && !isFormData && !isBlob) {
    // If a plain object/array was passed, JSON encode it
    if (!isString && (isPlainObject(body) || Array.isArray(body))) {
      finalBody = JSON.stringify(body)
      if (!finalHeaders.has('Content-Type')) {
        finalHeaders.set('Content-Type', 'application/json')
      }
    } else if (isString) {
      // If they pass a string, assume they know what they’re doing.
      // But set JSON content type if it looks like JSON and no header provided.
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

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: finalBody,
    signal,
  })

  const data = await readBody(res)

  if (!res.ok) {
    // Broadcast session expiry for auth gate
    if (res.status === 401 || res.status === 403) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    }
    throw makeError(res, data)
  }

  return data
}

// Optional small wrappers
export const apiGet = (path, opts) => api(path, { ...opts, method: 'GET' })
export const apiPost = (path, body, opts) =>
  api(path, { ...opts, method: 'POST', body })
export const apiPut = (path, body, opts) =>
  api(path, { ...opts, method: 'PUT', body })
export const apiPatch = (path, body, opts) =>
  api(path, { ...opts, method: 'PATCH', body })
export const apiDelete = (path, opts) =>
  api(path, { ...opts, method: 'DELETE' })
