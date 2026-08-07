import { useState } from 'react'
import { getCollectionNameValidationError } from '@app/features/collections/model/collection.validation'
import {
  createCollection,
  createWebsiteResource,
} from '@app/features/collections/model/collection.factory'
import {
  addCollection,
  addResourceToCollection,
  CollectionOperationError,
} from '@app/features/collections/model/collection.operations'
import type {
  CollectionId,
  CollectionsState,
} from '@app/features/collections/model/collection.types'
import { getWebsiteNameValidationError } from '@app/features/collections/model/website-resource.validation'
import type { ActivePage } from '@app/platform/browser/active-tab.adapter'

/** The two supported destinations for toolbar capture. */
export type CaptureDestination = 'existing' | 'new'

/** Controlled values entered in the toolbar capture form. */
export interface ToolbarCaptureValues {
  readonly name: string
  readonly destination: CaptureDestination
  readonly collectionId: CollectionId
  readonly newCollectionName: string
}

interface UseToolbarCaptureOptions {
  readonly page: ActivePage
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
}

/** Coordinates toolbar form validation and atomic resource persistence. */
export function useToolbarCapture({
  page,
  state,
  save,
}: UseToolbarCaptureOptions) {
  const firstCollectionId = state.collections[0]?.id ?? ''
  const [values, setValues] = useState<ToolbarCaptureValues>({
    name: page.title,
    destination: firstCollectionId ? 'existing' : 'new',
    collectionId: firstCollectionId,
    newCollectionName: '',
  })
  const [nameError, setNameError] = useState<string>()
  const [collectionError, setCollectionError] = useState<string>()
  const [submissionError, setSubmissionError] = useState<string>()
  const [successMessage, setSuccessMessage] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)

  /** Updates controlled values and clears feedback made stale by editing. */
  function updateValues(nextValues: ToolbarCaptureValues): void {
    setValues(nextValues)
    setSubmissionError(undefined)
    setSuccessMessage(undefined)

    if (nameError) {
      setNameError(getWebsiteNameValidationError(nextValues.name))
    }

    if (collectionError) {
      setCollectionError(
        nextValues.destination === 'new'
          ? getCollectionNameValidationError(nextValues.newCollectionName)
          : nextValues.collectionId
            ? undefined
            : 'Choose a collection.',
      )
    }
  }

  /** Validates and saves the page to an existing or newly created collection. */
  async function submit(): Promise<void> {
    const nextNameError = getWebsiteNameValidationError(values.name)
    const nextCollectionError =
      values.destination === 'new'
        ? getCollectionNameValidationError(values.newCollectionName)
        : values.collectionId
          ? undefined
          : 'Choose a collection.'

    setNameError(nextNameError)
    setCollectionError(nextCollectionError)

    if (nextNameError || nextCollectionError) {
      return
    }

    setIsSaving(true)
    setSubmissionError(undefined)
    setSuccessMessage(undefined)

    try {
      let nextState = state
      let targetCollectionId = values.collectionId
      let targetCollectionName = ''

      if (values.destination === 'new') {
        const collection = createCollection({
          name: values.newCollectionName,
          icon: 'folder',
          color: '#f97316',
        })
        nextState = addCollection(nextState, collection)
        targetCollectionId = collection.id
        targetCollectionName = collection.name
      } else {
        targetCollectionName =
          state.collections.find(
            collection => collection.id === targetCollectionId,
          )?.name ?? ''
      }

      const resource = createWebsiteResource({
        name: values.name,
        url: page.url,
      })
      nextState = addResourceToCollection(
        nextState,
        targetCollectionId,
        resource,
        resource.updatedAt,
      )

      await save(nextState)
      setSuccessMessage(`Saved to ${targetCollectionName}.`)
    } catch (error) {
      if (
        error instanceof CollectionOperationError &&
        error.code === 'DUPLICATE_RESOURCE_URL'
      ) {
        setSubmissionError(error.message)
      } else {
        console.error('Could not capture the active website', error)
        setSubmissionError('The page could not be saved. Try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  return {
    values,
    nameError,
    collectionError,
    submissionError,
    successMessage,
    isSaving,
    updateValues,
    submit,
  }
}
