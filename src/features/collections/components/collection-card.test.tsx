import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createTestCollection,
  createTestFileResource,
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

describe('CollectionCard export action', () => {
  it('does not render an export control by default', () => {
    const markup = renderToStaticMarkup(
      <CollectionCard
        collection={createTestCollection()}
        onOpenResource={noop}
        onOpenAll={noop}
      />,
    )

    expect(markup).not.toContain('Export Development')
  })

  it('renders an export control when onExport is provided', () => {
    const markup = renderToStaticMarkup(
      <CollectionCard
        collection={createTestCollection()}
        onOpenResource={noop}
        onOpenAll={noop}
        onExport={noop}
      />,
    )

    expect(markup).toContain('Export Development')
  })
})

describe('CollectionCard with file resources', () => {
  const noopProps = { onOpenResource: noop, onOpenAll: noop }

  // Transitional: file rows arrive in Phase G of V3. This pins that a
  // collection holding a file no longer breaks the card in the meantime.
  it('renders without error and still shows its website rows', () => {
    const collection = createTestCollection({
      resources: [
        createTestWebsiteResource({ name: 'GitHub' }),
        createTestFileResource({ name: 'Handbook' }),
      ],
    })

    const markup = renderToStaticMarkup(
      <CollectionCard collection={collection} {...noopProps} />,
    )

    expect(markup).toContain('GitHub')
  })

  it('counts file resources in the resource total', () => {
    const collection = createTestCollection({
      resources: [
        createTestWebsiteResource({ name: 'GitHub' }),
        createTestFileResource({ name: 'Handbook' }),
      ],
    })

    const markup = renderToStaticMarkup(
      <CollectionCard collection={collection} {...noopProps} />,
    )

    expect(markup).toContain('2 resources')
  })

  it('does not show the empty-state message for a collection holding only files', () => {
    const collection = createTestCollection({
      resources: [createTestFileResource()],
    })

    const markup = renderToStaticMarkup(
      <CollectionCard collection={collection} {...noopProps} />,
    )

    expect(markup).not.toContain('No resources saved yet.')
  })
})

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
