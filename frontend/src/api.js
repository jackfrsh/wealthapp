const API_BASE = '/api'

export function getToken() {
  return localStorage.getItem('access_token')
}

export function setToken(tok) {
  localStorage.setItem('access_token', tok)
}

export function clearToken() {
  localStorage.removeItem('access_token')
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const tok = getToken()
  if (tok) headers['Authorization'] = `Bearer ${tok}`

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const ct = res.headers.get('content-type') || ''
  const data = ct.includes('application/json')
    ? await res.json().catch(() => ({}))
    : await res.text()

  if (!res.ok) {
    const detail = typeof data === 'string' ? data : (data?.detail || JSON.stringify(data))
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return data
}
