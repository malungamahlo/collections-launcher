import { useState } from 'react'
import {
  createCollection,
  updateCollectionMetadata,
} from '../model/collection.factory'
import {
  addCollection,
  removeCollection,
  updateCollection,
} from '../model/collection.operations'
import type { Collection, CollectionsState } from '../model/collection.types'
import { getCollectionNameValidationError } from '../model/collection.validation'
import {
  EMPTY_COLLECTION_FORM_VALUES,
  type CollectionFormValues,
} from '../components/collection-form.types'

type CollectionEditor =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly collectionId: Collection['id'] }

interface UseCollectionManagementOptions {
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
}

/**
 * Coordinates collection dialogs, domain operations, validation, and persistence.
 */
export function useCollectionManagement({
  state,
  save,
}: UseCollectionManagementOptions) {
  const [editor, setEditor] = useState<CollectionEditor | null>(null)
  const [formValues, setFormValues] = useState<CollectionFormValues>(
    EMPTY_COLLECTION_FORM_VALUES,
  )
  const [nameError, setNameError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [collectionToDelete, setCollectionToDelete] =
    useState<Collection | null>(null)
  const [deleteError, setDeleteError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  /** Opens a clean form for a new collection. */
  function openCreate(): void {
    setFormValues(EMPTY_COLLECTION_FORM_VALUES)
    setNameError(undefined)
    setFormError(undefined)
    setEditor({ mode: 'create' })
  }

  /** Opens the same form populated with an existing collection's metadata. */
  function openEdit(collection: Collection): void {
    setFormValues({
      name: collection.name,
      description: collection.description ?? '',
      icon: collection.icon ?? 'folder',
      color: collection.color ?? '#f97316',
    })
    setNameError(undefined)
    setFormError(undefined)
    setEditor({ mode: 'edit', collectionId: collection.id })
  }

  /** Closes the editor unless a save is currently in progress. */
  function closeEditor(): void {
    if (!isSaving) {
      setEditor(null)
    }
  }

  /** Keeps controlled values and any visible name error synchronized. */
  function updateFormValues(values: CollectionFormValues): void {
    setFormValues(values)

    if (nameError) {
      setNameError(getCollectionNameValidationError(values.name))
    }
  }

  /** Creates or updates a collection and saves the resulting versioned state. */
  async function submitEditor(): Promise<void> {
    if (!editor) {
      return
    }

    const validationError = getCollectionNameValidationError(formValues.name)

    if (validationError) {
      setNameError(validationError)
      return
    }

    setIsSaving(true)
    setFormError(undefined)

    try {
      let nextState: CollectionsState

      if (editor.mode === 'create') {
        nextState = addCollection(state, createCollection(formValues))
      } else {
        const latestCollection = state.collections.find(
          collection => collection.id === editor.collectionId,
        )

        if (!latestCollection) {
          throw new Error('The collection no longer exists.')
        }

        nextState = updateCollection(
          state,
          updateCollectionMetadata(latestCollection, formValues),
        )
      }

      await save(nextState)
      setEditor(null)
    } catch (error) {
      console.error('Could not save collection', error)
      setFormError('The collection could not be saved. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  /** Opens deletion confirmation for the selected collection. */
  function requestDelete(collection: Collection): void {
    setDeleteError(undefined)
    setCollectionToDelete(collection)
  }

  /** Closes deletion confirmation unless a save is in progress. */
  function cancelDelete(): void {
    if (!isSaving) {
      setCollectionToDelete(null)
    }
  }

  /** Removes the confirmed collection and persists the resulting state. */
  async function confirmDelete(): Promise<void> {
    if (!collectionToDelete) {
      return
    }

    setIsSaving(true)
    setDeleteError(undefined)

    try {
      await save(removeCollection(state, collectionToDelete.id))
      setCollectionToDelete(null)
    } catch (error) {
      console.error('Could not delete collection', error)
      setDeleteError('The collection could not be deleted. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return {
    editor,
    formValues,
    nameError,
    formError,
    collectionToDelete,
    deleteError,
    isSaving,
    openCreate,
    openEdit,
    closeEditor,
    updateFormValues,
    submitEditor,
    requestDelete,
    cancelDelete,
    confirmDelete,
  }
}
