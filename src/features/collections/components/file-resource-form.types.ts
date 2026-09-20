import type { CollectionId } from '../model/collection.types'

/** Values edited by the add-a-file workflow. The file itself is chosen separately. */
export interface FileResourceFormValues {
  readonly name: string
  readonly collectionId: CollectionId
}

/** Creates clean form values with an optional preselected collection. */
export function createEmptyFileResourceFormValues(
  collectionId: CollectionId = '',
): FileResourceFormValues {
  return {
    name: '',
    collectionId,
  }
}

/** What the form shows about the file the user has chosen so far. */
export interface ChosenFileSummary {
  readonly fileName: string
  /** A human-readable kind, e.g. "PDF document". */
  readonly kindLabel: string
  readonly sizeBytes: number
}
