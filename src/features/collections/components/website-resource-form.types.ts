import type { CollectionId } from '../model/collection.types'

/** Values edited by website creation and editing workflows. */
export interface WebsiteResourceFormValues {
  readonly name: string
  readonly url: string
  readonly collectionId: CollectionId
}

/** Creates clean form values with an optional preselected collection. */
export function createEmptyWebsiteResourceFormValues(
  collectionId: CollectionId = '',
): WebsiteResourceFormValues {
  return {
    name: '',
    url: '',
    collectionId,
  }
}
