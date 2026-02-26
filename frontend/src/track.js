import { api } from './api'

export async function track(name, meta) {
    try {
      if (import.meta.env.DEV) {
        console.log('[track]', name, meta || '')
      }
  
      await api('/events', {
        method: 'POST',
        body: { name, meta },
      })
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('track failed', name, e)
      }
    }
  }