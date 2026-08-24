/** Values edited by the create and edit collection workflows. */
export interface CollectionFormValues {
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly color: string
}

/** Initial values for a new collection. */
export const EMPTY_COLLECTION_FORM_VALUES: CollectionFormValues = {
  name: '',
  description: '',
  icon: 'folder',
  color: '#f97316',
}
