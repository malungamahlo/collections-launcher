import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NoSearchResultsEmptyState } from './no-search-results-empty-state'

describe('NoSearchResultsEmptyState', () => {
  it('explains that no collection or website matches the query', () => {
    const markup = renderToStaticMarkup(
      <NoSearchResultsEmptyState query="nonexistent" />,
    )

    expect(markup).toContain('No results for')
    expect(markup).toContain('nonexistent')
    expect(markup).toContain('Try a different collection name')
  })
})
