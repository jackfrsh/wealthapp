import { useEffect } from 'react'

function upsertMetaByName(name, content) {
  if (!content) return
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLinkRel(rel, href) {
  if (!href) return
  let el = document.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertOG(property, content) {
  if (!content) return
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function useSEO({ title, description, canonicalPath }) {
  useEffect(() => {
    const origin = 'https://getpaddock.com'
    const canonical = canonicalPath ? `${origin}${canonicalPath}` : null

    if (title) document.title = title
    if (description) upsertMetaByName('description', description)

    if (canonical) upsertLinkRel('canonical', canonical)

    // Social previews
    if (title) upsertOG('og:title', title)
    if (description) upsertOG('og:description', description)
    if (canonical) upsertOG('og:url', canonical)
  }, [title, description, canonicalPath])
}