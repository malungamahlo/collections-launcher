import { useState } from 'react'
import type { FileContentAdapter } from '@app/platform/browser/file-content.adapter'
import type { StorageQuotaAdapter } from '@app/platform/browser/storage-quota.adapter'
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
import { getStorageShortfall } from '../model/storage-room'
import {
  getFilePickerTypes,
  getResourceKind,
  inferMimeType,
} from '../model/resource-kind-registry'
import {
  getWebsiteNameValidationError,
  WEBSITE_NAME_MAX_LENGTH,
} from '../model/website-resource.validation'
import { describeStorageShortfall } from './file-read-messages'
import {
  createEmptyFileResourceFormValues,
  type ChosenFileSummary,
  type FileResourceFormValues,
} from '../components/file-resource-form.types'

/** What is known about the file the user picked, kept until they confirm. */
export interface PickedFileDetails {
  /**
   * The picked file. It is a view of the file on disk until the user
   * confirms; a copy of its bytes is what gets stored, and after that the
   * original is never read again.
   */
  readonly file: Blob
  readonly fileName: string
  readonly mimeType: string
  readonly sizeBytes: number
}

interface UseFileResourceManagementOptions {
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
  readonly filePicker: FilePickerAdapter
  readonly fileContent: Pick<FileContentAdapter, 'saveBlob' | 'remove'>
  /** How much room the browser has for the copy, and a way to ask it to keep it. */
  readonly storage: Pick<StorageQuotaAdapter, 'estimate' | 'persist'>
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
 * picker, naming it, and persisting both the resource and **a copy of the
 * file**. The collection owns that copy, the way a file uploaded to a chat
 * belongs to the chat: the user's original is never read again and never
 * changed, so moving or deleting it later affects nothing here.
 *
 * Nothing is left half-done — the resource is only saved after the copy is
 * stored, and if saving the resource then fails the copy is removed again.
 */
export function useFileResourceManagement({
  state,
  save,
  filePicker,
  fileContent,
  storage,
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
        file: picked.file,
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

  /** Removes a stored copy after a failed save; a failure here is only logged. */
  async function discardStoredContent(id: ResourceId): Promise<void> {
    try {
      await fileContent.remove(id)
    } catch (error) {
      console.error('Could not remove a stored file after a failed save', error)
    }
  }

  /**
   * Reads the picked file into memory. Between choosing it and confirming,
   * the file may have been moved, deleted or changed; a file that can no
   * longer be read is reported rather than stored half-way.
   */
  async function readPickedFile(picked: PickedFileDetails): Promise<Blob | undefined> {
    try {
      return new Blob([await picked.file.arrayBuffer()], { type: picked.mimeType })
    } catch (error) {
      console.error('Could not read the picked file', error)

      return undefined
    }
  }

  /** Validates, then stores a copy of the file and saves the new resource. */
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
      const content = await readPickedFile(pickedFile)

      if (!content) {
        setFileError('That file could not be read. It may have been moved or deleted. Choose it again.')
        return
      }

      // The file as it is now, which may differ from when it was chosen.
      const currentSizeError = getFileSizeValidationError(content.size)

      if (currentSizeError) {
        setFileError(currentSizeError)
        return
      }

      const shortfall = getStorageShortfall(content.size, await storage.estimate())

      if (shortfall) {
        setFileError(describeStorageShortfall(shortfall, 'this file'))
        return
      }

      const resource = createFileResource({
        name: formValues.name,
        mimeType: pickedFile.mimeType,
        sizeBytes: content.size,
      })
      // Checked before anything is stored, so a rejected name or a missing
      // collection never leaves a stored file behind.
      const nextState = addResourceToCollection(
        state,
        formValues.collectionId,
        resource,
        resource.updatedAt,
      )

      // Recorded first: a write that fails half-way may still have left something.
      storedResourceId = resource.id
      await fileContent.saveBlob(resource.id, content)
      await save(nextState)
      setIsOpen(false)
      // The collection's copy is the only one it has, so ask the browser to
      // keep it. Not awaited: the file is added whether or not it agrees.
      void storage.persist()
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
