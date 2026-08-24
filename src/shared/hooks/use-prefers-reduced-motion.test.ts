// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePrefersReducedMotion } from './use-prefers-reduced-motion'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Builds a minimal MediaQueryList mock with a controllable `matches` value. */
function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches
  let changeHandler: (() => void) | undefined

  const mediaQueryList = {
    get matches() {
      return matches
    },
    addEventListener: (
      _event: string,
      handler: () => void,
    ) => {
      changeHandler = handler
    },
    removeEventListener: () => {
      changeHandler = undefined
    },
  }

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue(mediaQueryList),
  )

  return {
    setMatches: (next: boolean) => {
      matches = next
      changeHandler?.()
    },
  }
}

describe('usePrefersReducedMotion', () => {
  it('reflects the initial media query state', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(result.current).toBe(true)
  })

  it('updates when the media query changes', () => {
    const { setMatches } = mockMatchMedia(false)
    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(result.current).toBe(false)

    act(() => setMatches(true))

    expect(result.current).toBe(true)
  })
})
