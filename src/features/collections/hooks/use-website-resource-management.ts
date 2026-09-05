import { useState } from 'react'
import {
  createWebsiteResource,
  updateWebsiteResourceMetadata,
} from '../model/collection.factory'
import {
  addResourceToCollection,
  CollectionOperationError,
  removeResourceFromCollection,
  updateResourceInCollection,
} from '../model/collection.operations'
import type {
  Collection,
  CollectionId,
  CollectionsState,
  ResourceId,
  WebsiteResource,
} from '../model/collection.types'
import {
  getWebsiteNameValidationError,
  getWebsiteUrlValidationError,
} from '../model/website-resource.validation'
import {
  createEmptyWebsiteResourceFormValues,
  type WebsiteResourceFormValues,
} from '../components/website-resource-form.types'

type WebsiteResourceEditor =
  | { readonly mode: 'create' }
  | {
      readonly mode: 'edit'
      readonly sourceCollectionId: CollectionId
      readonly resourceId: ResourceId
    }

interface PendingResourceDeletion {
  readonly collection: Collection
  readonly resource: WebsiteResource
}

interface UseWebsiteResourceManagementOptions {
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
}

/**
 * Coordinates website creation, editing, moving, deletion, and persistence.
 */
export function useWebsiteResourceManagement({
  state,
  save,
}: UseWebsiteResourceManagementOptions) {
  const [editor, setEditor] = useState<WebsiteResourceEditor | null>(null)
  const [formValues, setFormValues] = useState<WebsiteResourceFormValues>(
    createEmptyWebsiteResourceFormValues,
  )
  const [nameError, setNameError] = useState<string>()
  const [urlError, setUrlError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [resourceToDelete, setResourceToDelete] =
    useState<PendingResourceDeletion | null>(null)
  const [deleteError, setDeleteError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  /** Opens a clean form preselected to the collection card used as the trigger. */
  function openCreate(collection: Collection): void {
    setFormValues(createEmptyWebsiteResourceFormValues(collection.id))
    setNameError(undefined)
    setUrlError(undefined)
    setFormError(undefined)
    setEditor({ mode: 'create' })
  }

  /** Opens the form with current website values and its source collection. */
  function openEdit(
    collection: Collection,
    resource: WebsiteResource,
  ): void {
    setFormValues({
      name: resource.name,
      url: resource.url,
      collectionId: collection.id,
    })
    setNameError(undefined)
    setUrlError(undefined)
    setFormError(undefined)
    setEditor({
      mode: 'edit',
      sourceCollectionId: collection.id,
      resourceId: resource.id,
    })
  }

  /** Closes the resource editor unless persistence is in progress. */
  function closeEditor(): void {
    if (!isSaving) {
      setEditor(null)
    }
  }

  /** Keeps controlled values and visible validation messages synchronized. */
  function updateFormValues(values: WebsiteResourceFormValues): void {
    setFormValues(values)
    setFormError(undefined)

    if (nameError) {
      setNameError(getWebsiteNameValidationError(values.name))
    }

    if (urlError) {
      setUrlError(getWebsiteUrlValidationError(values.url))
    }
  }

  /** Validates and persists a newly created or edited website resource. */
  async function submitEditor(): Promise<void> {
    if (!editor) {
      return
    }

    const nextNameError = getWebsiteNameValidationError(formValues.name)
    const nextUrlError = getWebsiteUrlValidationError(formValues.url)
    setNameError(nextNameError)
    setUrlError(nextUrlError)

    if (nextNameError || nextUrlError) {
      return
    }

    setIsSaving(true)
    setFormError(undefined)

    try {
      let nextState: CollectionsState

      if (editor.mode === 'create') {
        const resource = createWebsiteResource({
          name: formValues.name,
          url: formValues.url,
        })
        nextState = addResourceToCollection(
          state,
          formValues.collectionId,
          resource,
          resource.updatedAt,
        )
      } else {
        const sourceCollection = state.collections.find(
          collection => collection.id === editor.sourceCollectionId,
        )
        const currentResource = sourceCollection?.resources.find(
          resource => resource.id === editor.resourceId,
        )

        if (!sourceCollection || !currentResource) {
          throw new Error('The website resource no longer exists.')
        }

        const updatedResource = updateWebsiteResourceMetadata(
          currentResource,
          {
            name: formValues.name,
            url: formValues.url,
          },
        )

        if (sourceCollection.id === formValues.collectionId) {
          nextState = updateResourceInCollection(
            state,
            sourceCollection.id,
            updatedResource,
            updatedResource.updatedAt,
          )
        } else {
          const stateWithoutResource = removeResourceFromCollection(
            state,
            sourceCollection.id,
            currentResource.id,
            updatedResource.updatedAt,
          )
          nextState = addResourceToCollection(
            stateWithoutResource,
            formValues.collectionId,
            updatedResource,
            updatedResource.updatedAt,
          )
        }
      }

      await save(nextState)
      setEditor(null)
    } catch (error) {
      if (
        error instanceof CollectionOperationError &&
        error.code === 'DUPLICATE_RESOURCE_URL'
      ) {
        setUrlError(error.message)
      } else if (
        error instanceof CollectionOperationError &&
        error.code === 'DUPLICATE_RESOURCE_NAME'
      ) {
        setNameError(error.message)
      } else {
        console.error('Could not save website resource', error)
        setFormError('The website could not be saved. Try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  /** Opens confirmation for one website inside its current collection. */
  function requestDelete(
    collection: Collection,
    resource: WebsiteResource,
  ): void {
    setDeleteError(undefined)
    setResourceToDelete({ collection, resource })
  }

  /** Closes resource deletion confirmation unless a save is active. */
  function cancelDelete(): void {
    if (!isSaving) {
      setResourceToDelete(null)
    }
  }

  /** Removes the confirmed website and updates its collection timestamp. */
  async function confirmDelete(): Promise<void> {
    if (!resourceToDelete) {
      return
    }

    setIsSaving(true)
    setDeleteError(undefined)

    try {
      const nextState = removeResourceFromCollection(
        state,
        resourceToDelete.collection.id,
        resourceToDelete.resource.id,
        Date.now(),
      )
      await save(nextState)
      setResourceToDelete(null)
    } catch (error) {
      console.error('Could not delete website resource', error)
      setDeleteError('The website could not be deleted. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return {
    editor,
    formValues,
    nameError,
    urlError,
    formError,
    resourceToDelete,
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
