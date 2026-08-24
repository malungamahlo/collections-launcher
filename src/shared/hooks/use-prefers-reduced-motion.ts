import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** Whether `window.matchMedia` is available in the current render environment. */
function canQueryMotionPreference(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/** Tracks the user's `prefers-reduced-motion` preference live. */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    canQueryMotionPreference() ? window.matchMedia(QUERY).matches : false,
  )

  useEffect(() => {
    if (!canQueryMotionPreference()) {
      return
    }

    const mediaQuery = window.matchMedia(QUERY)
    const handleChange = () =>
      setPrefersReducedMotion(mediaQuery.matches)

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}
