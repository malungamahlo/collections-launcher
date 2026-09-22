// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useDocumentTitle } from './use-document-title'

beforeEach(() => {
  document.title = 'Collections Launcher'
})

afterEach(cleanup)

describe('useDocumentTitle', () => {
  it('names the tab while mounted', () => {
    renderHook(() => useDocumentTitle('Handbook'))

    expect(document.title).toBe('Handbook')
  })

  it('puts the previous title back when it goes away', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Handbook'))

    unmount()

    expect(document.title).toBe('Collections Launcher')
  })

  it('follows a title that changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Handbook' },
    })

    rerender({ title: 'Notes' })

    expect(document.title).toBe('Notes')
  })
})
