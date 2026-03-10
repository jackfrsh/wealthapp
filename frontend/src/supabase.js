import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const AUTH_STORAGE_KEY = 'wealthapp-auth'
export const AUTH_MODE_KEY = 'wealthapp-auth-mode'

// If either value is missing, export null so the app can fail gracefully.
const hasCreds = Boolean(supabaseUrl && supabaseAnonKey)

function createMemoryStorage() {
  const store = new Map()

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

const memoryStorage = createMemoryStorage()

function getSafeStorage(type) {
  try {
    if (typeof window === 'undefined') return null

    const storage = window[type]
    if (!storage) return null

    const probeKey = `__paddock_storage_probe__${type}`
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)

    return storage
  } catch {
    return null
  }
}

const localStorageRef = getSafeStorage('localStorage')
const sessionStorageRef = getSafeStorage('sessionStorage')

function getModeStorage() {
  return localStorageRef || sessionStorageRef || memoryStorage
}

export function getAuthPersistenceMode() {
  try {
    const raw = (getModeStorage().getItem(AUTH_MODE_KEY) || '').toLowerCase()
    return raw === 'session' ? 'session' : 'persistent'
  } catch {
    return 'persistent'
  }
}

export function setAuthPersistenceMode(mode) {
  const next = mode === 'session' ? 'session' : 'persistent'

  try {
    getModeStorage().setItem(AUTH_MODE_KEY, next)
  } catch {}

  try {
    if (next === 'session') {
      localStorageRef?.removeItem(AUTH_STORAGE_KEY)
    } else {
      sessionStorageRef?.removeItem(AUTH_STORAGE_KEY)
    }
  } catch {}
}

export function clearStoredAuthSession() {
  try {
    localStorageRef?.removeItem(AUTH_STORAGE_KEY)
  } catch {}

  try {
    sessionStorageRef?.removeItem(AUTH_STORAGE_KEY)
  } catch {}

  try {
    memoryStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {}
}

function getActiveAuthStorage() {
  const mode = getAuthPersistenceMode()

  if (mode === 'session') {
    return sessionStorageRef || memoryStorage
  }

  return localStorageRef || memoryStorage
}

function getInactiveAuthStorage() {
  const mode = getAuthPersistenceMode()

  if (mode === 'session') {
    return localStorageRef
  }

  return sessionStorageRef
}

const authStorage = {
  getItem(key) {
    try {
      return getActiveAuthStorage().getItem(key)
    } catch {
      return null
    }
  },

  setItem(key, value) {
    try {
      getActiveAuthStorage().setItem(key, value)
    } catch {}

    try {
      getInactiveAuthStorage()?.removeItem(key)
    } catch {}
  },

  removeItem(key) {
    try {
      localStorageRef?.removeItem(key)
    } catch {}

    try {
      sessionStorageRef?.removeItem(key)
    } catch {}

    try {
      memoryStorage.removeItem(key)
    } catch {}
  },
}

export const supabase = hasCreds
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: authStorage,
        storageKey: AUTH_STORAGE_KEY,
      },
    })
  : null

export default supabase

// Expose to devtools in development only
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.supabase = supabase
}