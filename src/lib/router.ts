import { useSyncExternalStore } from 'react'

// Hash routing keeps deep links working on GitHub Pages without server rewrites.

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const getPath = () => window.location.hash.replace(/^#/, '') || '/'

export function useRoute(): string[] {
  const path = useSyncExternalStore(subscribe, getPath)
  return path.split('/').filter(Boolean)
}

export function navigate(path: string, { replace = false } = {}) {
  if (replace) window.location.replace(`#${path}`)
  else window.location.hash = path
}
