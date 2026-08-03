import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CollectionsEmptyState } from './collections-empty-state'

describe('CollectionsEmptyState', () => {
  it('explains that the user has no collections', () => {
    const markup = renderToStaticMarkup(<CollectionsEmptyState />)

    expect(markup).toContain('No collections yet')
    expect(markup).toContain('Collections you create will appear here')
  })
})
