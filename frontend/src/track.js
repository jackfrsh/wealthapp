import { api } from './api'

const PAGE_VIEW_DEDUP_MS = 15_000
let lastPageView = { page: null, at: 0 }

function normalizePayload(name, payload) {
  const input =
    payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}

  const hasReservedKeys =
    Object.prototype.hasOwnProperty.call(input, 'page') ||
    Object.prototype.hasOwnProperty.call(input, 'entityType') ||
    Object.prototype.hasOwnProperty.call(input, 'entity_type') ||
    Object.prototype.hasOwnProperty.call(input, 'entityId') ||
    Object.prototype.hasOwnProperty.call(input, 'entity_id') ||
    Object.prototype.hasOwnProperty.call(input, 'meta')

  if (!hasReservedKeys) {
    return {
      name,
      meta: input,
    }
  }

  const rest = { ...input }

  const page =
    typeof rest.page === 'string' && rest.page.trim() ? rest.page.trim() : null

  const entityTypeRaw = rest.entityType ?? rest.entity_type ?? null
  const entityIdRaw = rest.entityId ?? rest.entity_id ?? null
  const metaSource = rest.meta

  delete rest.page
  delete rest.entityType
  delete rest.entity_type
  delete rest.entityId
  delete rest.entity_id
  delete rest.meta

  const meta =
    metaSource && typeof metaSource === 'object' && !Array.isArray(metaSource)
      ? { ...metaSource }
      : {}

  Object.assign(meta, rest)

  return {
    name,
    page,
    entity_type:
      typeof entityTypeRaw === 'string' && entityTypeRaw.trim()
        ? entityTypeRaw.trim()
        : null,
    entity_id:
      entityIdRaw === null || entityIdRaw === undefined || entityIdRaw === ''
        ? null
        : String(entityIdRaw),
    meta,
  }
}

function shouldSkipPageView(body) {
  if (body?.name !== 'page_view') return false

  const page =
    (typeof body.page === 'string' && body.page) ||
    (body?.meta && typeof body.meta.page === 'string' && body.meta.page) ||
    null

  if (!page) return false

  const now = Date.now()
  if (lastPageView.page === page && now - lastPageView.at < PAGE_VIEW_DEDUP_MS) {
    return true
  }

  lastPageView = { page, at: now }
  return false
}

export async function track(name, payload) {
  try {
    const body = normalizePayload(name, payload)

    if (shouldSkipPageView(body)) return

    if (import.meta.env.DEV) {
      console.log('[track]', body.name, body)
    }

    await api('/events', {
      method: 'POST',
      body,
    })
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('track failed', name, e)
    }
  }
}