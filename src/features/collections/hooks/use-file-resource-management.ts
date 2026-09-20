import { useState } from 'react'
import type { FileContentAdapter } from '@app/platform/browser/file-content.adapter'
import {
  FilePickerError,
  type FilePickerAdapter,
} from '@app/platform/browser/file-picker.adapter'
import { createFileResource } from '../model/collection.factory'
import {
  addResourceToCollection,
  CollectionOperationError,
} from '../model/collection.operations'
import type {
  Collection,
  CollectionsState,
  ResourceId,
} from '../model/collection.types'
import { getFileSizeValidationError } from '../model/file-resource.validation'
import {
  getFilePickerTypes,
  getResourceKind,
  inferMimeType,
} from '../model/resource-kind-registry'
import {
  getWebsiteNameValidationError,
  WEBSITE_NAME_MAX_LENGTH,
} from '../model/website-resource.validation'
import {
  createEmptyFileResourceFormValues,
  type ChosenFileSummary,
  type FileResourceFormValues,
} from '../components/file-resource-form.types'

/** What is known about the file the user picked, kept until they confirm. */
export interface PickedFileDetails {
  /** A live reference to the user's file; this, not a copy, is what gets stored. */
  readonly handle: FileSystemFileHandle
  readonly fileName: string
  readonly mimeType: string
  readonly sizeBytes: number
}

interface UseFileResourceManagementOptions {
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
  readonly filePicker: FilePickerAdapter
  readonly fileContent: FileContentAdapter
}

/**
 * Suggests a resource name from a file name: the name without its extension,
 * cut to the maximum name length. A name that is nothing but an extension
 * (`.pdf`) is kept whole rather than suggesting an empty name.
 */
export function suggestResourceName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, '').trim()

  return (withoutExtension || fileName.trim()).slice(0, WEBSITE_NAME_MAX_LENGTH)
}

/**
 * Coordinates adding a file to a collection: choosing it with the native
 * picker, naming it, and persisting both the resource and a reference to the
 * file. Nothing is left half-done — the resource is only saved after the
 * file reference is stored, and if saving the resource then fails the
 * reference is removed again.
 */
export function useFileResourceManagement({
  state,
  save,
  filePicker,
  fileContent,
}: UseFileResourceManagementOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [formValues, setFormValues] = useState<FileResourceFormValues>(
    createEmptyFileResourceFormValues,
  )
  const [pickedFile, setPickedFile] = useState<PickedFileDetails>()
  // The last name suggested from a picked file. A name the user has typed
  // over is theirs and is never replaced by a later suggestion.
  const [suggestedName, setSuggestedName] = useState('')
  const [nameError, setNameError] = useState<string>()
  const [fileError, setFileError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [isPicking, setIsPicking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  /** Opens a clean form preselected to the collection card used as the trigger. */
  function openCreate(collection: Collection): void {
    setFormValues(createEmptyFileResourceFormValues(collection.id))
    setPickedFile(undefined)
    setSuggestedName('')
    setNameError(undefined)
    setFileError(undefined)
    setFormError(undefined)
    setIsOpen(true)
  }

  /** Closes the form unless a save is in progress. */
  function close(): void {
    if (!isSaving) {
      setIsOpen(false)
    }
  }

  /** Keeps controlled values and any visible name error in step. */
  function updateFormValues(values: FileResourceFormValues): void {
    setFormValues(values)
    setFormError(undefined)

    if (nameError) {
      setNameError(getWebsiteNameValidationError(values.name))
    }
  }

  /**
   * Opens the native file picker (this must run from a click) and, if a file
   * is chosen and acceptable, remembers it and suggests a name. Dismissing
   * the picker changes nothing. A refused file — too large, unreadable —
   * leaves any earlier choice in place and says why.
   */
  async function chooseFile(): Promise<void> {
    if (isPicking || isSaving) {
      return
    }

    setIsPicking(true)
    setFileError(undefined)
    setFormError(undefined)

    try {
      const picked = await filePicker.pickFile(getFilePickerTypes())

      if (!picked) {
        return
      }

      const sizeError = getFileSizeValidationError(picked.file.size)

      if (sizeError) {
        setFileError(sizeError)
        return
      }

      const suggestion = suggestResourceName(picked.file.name)

      setPickedFile({
        handle: picked.handle,
        fileName: picked.file.name,
        mimeType: inferMimeType(picked.file.name, picked.file.type),
        sizeBytes: picked.file.size,
      })
      setSuggestedName(suggestion)
      setFormValues(current =>
        current.name.trim() === '' || current.name === suggestedName
          ? { ...current, name: suggestion }
          : current,
      )
      setNameError(undefined)
    } catch (error) {
      if (error instanceof FilePickerError) {
        setFileError(error.message)
      } else {
        console.error('Could not pick a file', error)
        setFileError('The file could not be added. Try again.')
      }
    } finally {
      setIsPicking(false)
    }
  }

  /** Forgets a stored file reference after a failed save; a failure here is only logged. */
  async function discardStoredContent(id: ResourceId): Promise<void> {
    try {
      await fileContent.remove(id)
    } catch (error) {
      console.error('Could not remove a file reference after a failed save', error)
    }
  }

  /** Validates, then stores the file reference and saves the new resource. */
  async function submit(): Promise<void> {
    if (!isOpen || isSaving) {
      return
    }

    const nextNameError = getWebsiteNameValidationError(formValues.name)
    const nextFileError = pickedFile
      ? getFileSizeValidationError(pickedFile.sizeBytes)
      : 'Choose a file to add.'
    setNameError(nextNameError)
    setFileError(nextFileError)

    if (nextNameError || nextFileError || !pickedFile) {
      return
    }

    setIsSaving(true)
    setFormError(undefined)

    let storedResourceId: ResourceId | undefined

    try {
      const resource = createFileResource({
        name: formValues.name,
        mimeType: pickedFile.mimeType,
        sizeBytes: pickedFile.sizeBytes,
      })
      // Checked before anything is stored, so a rejected name or a missing
      // collection never leaves a file reference behind.
      const nextState = addResourceToCollection(
        state,
        formValues.collectionId,
        resource,
        resource.updatedAt,
      )

      await fileContent.saveHandle(resource.id, pickedFile.handle)
      storedResourceId = resource.id
      await save(nextState)
      setIsOpen(false)
    } catch (error) {
      if (storedResourceId) {
        await discardStoredContent(storedResourceId)
      }

      if (
        error instanceof CollectionOperationError &&
        error.code === 'DUPLICATE_RESOURCE_NAME'
      ) {
        setNameError(error.message)
      } else {
        console.error('Could not save file resource', error)
        setFormError('The file could not be added. Try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  /** What the form shows about the chosen file: its name, kind, and size. */
  const chosenFile: ChosenFileSummary | undefined = pickedFile && {
    fileName: pickedFile.fileName,
    kindLabel: getResourceKind(pickedFile.mimeType).label,
    sizeBytes: pickedFile.sizeBytes,
  }

  return {
    isOpen,
    formValues,
    pickedFile,
    chosenFile,
    nameError,
    fileError,
    formError,
    isPicking,
    isSaving,
    openCreate,
    close,
    updateFormValues,
    chooseFile,
    submit,
  }
}
