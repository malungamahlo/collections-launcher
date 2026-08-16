import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createTestCollection,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import { CollectionCard } from './collection-card'

const noop = () => undefined

function renderCard(resourceCount: number): string {
  const resources = Array.from({ length: resourceCount }, (_, index) =>
    createTestWebsiteResource({
      id: `resource-${index}`,
      name: `Resource ${index}`,
      url: `https://example${index}.com/`,
    }),
  )
  const collection = createTestCollection({ resources })

  return renderToStaticMarkup(
    <CollectionCard
      collection={collection}
      onOpenResource={noop}
      onOpenAll={noop}
    />,
  )
}

describe('CollectionCard resource scroll fade', () => {
  it('does not render a scroll fade for a short resource list', () => {
    const markup = renderCard(3)

    expect(markup).not.toContain('bg-gradient-to-t')
  })

  it('renders a scroll fade once the resource list exceeds the visible rows', () => {
    const markup = renderCard(6)

    expect(markup).toContain('bg-gradient-to-t')
  })
})
