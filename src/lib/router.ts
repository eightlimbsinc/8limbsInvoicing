import { useSyncExternalStore } from 'react'

// Hash routing keeps deep links working on GitHub Pages without server rewrites.
// Routes look like #/invoices/<id> or #/recurring/new?from=<id>.

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const getHash = () => window.location.hash.replace(/^#/, '') || '/'

export function useRoute(): { path: string[]; query: URLSearchParams } {
  const hash = useSyncExternalStore(subscribe, getHash)
  const [path, query = ''] = hash.split('?')
  return { path: path.split('/').filter(Boolean), query: new URLSearchParams(query) }
}

export function navigate(path: string, { replace = false } = {}) {
  if (replace) window.location.replace(`#${path}`)
  else window.location.hash = path
}
