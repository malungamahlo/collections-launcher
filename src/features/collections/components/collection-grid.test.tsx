import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEVELOPMENT_SAMPLE_STATE } from '../development/sample-collections'
import { CollectionGrid } from './collection-grid'

describe('CollectionGrid', () => {
  it('renders sample collections and resources', () => {
    const markup = renderToStaticMarkup(
      <CollectionGrid
        collections={DEVELOPMENT_SAMPLE_STATE.collections}
      />,
    )

    for (const collection of DEVELOPMENT_SAMPLE_STATE.collections) {
      expect(markup).toContain(collection.name)

      for (const resource of collection.resources) {
        expect(markup).toContain(resource.name)
      }
    }
  })
})
