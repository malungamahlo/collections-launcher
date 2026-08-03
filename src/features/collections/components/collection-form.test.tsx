import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CollectionForm } from './collection-form'
import { EMPTY_COLLECTION_FORM_VALUES } from './collection-form.types'

describe('CollectionForm', () => {
  it('renders all collection metadata fields and actions', () => {
    const markup = renderToStaticMarkup(
      <CollectionForm
        values={EMPTY_COLLECTION_FORM_VALUES}
        submitLabel="Create collection"
        onValuesChange={() => undefined}
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />,
    )

    expect(markup).toContain('Collection name')
    expect(markup).toContain('Description')
    expect(markup).toContain('Icon')
    expect(markup).toContain('Collection color')
    expect(markup).toContain('Create collection')
    expect(markup).toContain('Cancel')
  })

  it('renders submission progress and a storage error without hiding values', () => {
    const values = {
      ...EMPTY_COLLECTION_FORM_VALUES,
      name: 'Development',
    }
    const markup = renderToStaticMarkup(
      <CollectionForm
        values={values}
        submitLabel="Create collection"
        isSubmitting
        submissionError="The collection could not be saved."
        onValuesChange={() => undefined}
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />,
    )

    expect(markup).toContain('Development')
    expect(markup).toContain('Saving…')
    expect(markup).toContain('The collection could not be saved.')
    expect(markup).toContain('disabled')
  })
})
