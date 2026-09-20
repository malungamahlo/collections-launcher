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

  it('shows website and file rows together, in collection order', () => {
    const collection = createTestCollection({
      resources: [
        createTestWebsiteResource({ name: 'GitHub' }),
        createTestFileResource({
          name: 'Handbook',
          mimeType: 'application/pdf',
          sizeBytes: 2_048,
        }),
      ],
    })

    const markup = renderToStaticMarkup(
      <CollectionCard collection={collection} {...noopProps} />,
    )

    expect(markup).toContain('GitHub')
    expect(markup).toContain('Handbook')
    expect(markup).toContain('PDF document')
    expect(markup.indexOf('GitHub')).toBeLessThan(markup.indexOf('Handbook'))
  })

  it('shows a collection holding only files, rather than an empty state', () => {
    const collection = createTestCollection({
      resources: [createTestFileResource({ name: 'Handbook' })],
    })

    const markup = renderToStaticMarkup(
      <CollectionCard collection={collection} {...noopProps} />,
    )

    expect(markup).toContain('Handbook')
    expect(markup).not.toContain('No resources saved yet.')
  })

  it('has one "Add resource" button and no separate "Add file" button', () => {
    const markup = renderToStaticMarkup(
      <CollectionCard
        collection={createTestCollection()}
        {...noopProps}
        onAddResource={noop}
      />,
    )

    expect(markup).toContain('Add resource')
    expect(markup).not.toContain('Add file')
  })

  it('disables "Open all" for a collection with no websites to open', () => {
    const onlyFiles = createTestCollection({
      resources: [createTestFileResource()],
    })
    const withWebsite = createTestCollection({
      resources: [createTestWebsiteResource()],
    })

    const filesMarkup = renderToStaticMarkup(
      <CollectionCard collection={onlyFiles} {...noopProps} />,
    )
    const websiteMarkup = renderToStaticMarkup(
      <CollectionCard collection={withWebsite} {...noopProps} />,
    )

    // Match the real `disabled=""` attribute, not the `disabled:` utility
    // classes that every button carries in its class list.
    const disabledOpenAll =
      /<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>).)*Open all/s

    expect(filesMarkup).toMatch(disabledOpenAll)
    expect(websiteMarkup).not.toMatch(disabledOpenAll)
  })

  it('lets a file be deleted through the same handler as a website', () => {
    const collection = createTestCollection({
      resources: [createTestFileResource({ name: 'Handbook' })],
    })

    const markup = renderToStaticMarkup(
      <CollectionCard
        collection={collection}
        {...noopProps}
        onDeleteResource={noop}
      />,
    )

    expect(markup).toContain('Delete Handbook')
  })

  it('does not offer to edit a file, since only websites are edited', () => {
    const collection = createTestCollection({
      resources: [createTestFileResource({ name: 'Handbook' })],
    })

    const markup = renderToStaticMarkup(
      <CollectionCard
        collection={collection}
        {...noopProps}
        onEditResource={noop}
      />,
    )

    expect(markup).not.toContain('Edit Handbook')
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
