import { useRef, useState } from 'react'
import { getCollectionNameValidationError } from '@app/features/collections/model/collection.validation'
import { CollectionOperationError } from '@app/features/collections/model/collection.operations'
import type {
  CollectionsState,
  ResourceId,
} from '@app/features/collections/model/collection.types'
import { describeStorageShortfall } from '@app/features/collections/hooks/file-read-messages'
import { getStorageShortfall } from '@app/features/collections/model/storage-room'
import type { FileContentAdapter } from '@app/platform/browser/file-content.adapter'
import type { StorageQuotaAdapter } from '@app/platform/browser/storage-quota.adapter'
import {
  buildImportPreview,
  buildPackageImportPreview,
  hasCollectionNameConflict,
  prepareImport,
  type ImportedFileContent,
  type ImportPreview,
} from '../services/import-collection-bundle'
import {
  readImportedFile,
  type ImportReadProgress,
  type ImportRejection,
} from '../services/read-collection-package'

const NAME_CONFLICT_ERROR = 'A collection with this name already exists.'

/** Explicit states the import workflow moves through, one file at a time. */
export type ImportCollectionState =
  | { readonly status: 'idle' }
  /** The picked file is being read and, for a package, its files checked. */
  | { readonly status: 'reading'; readonly progress?: ImportReadProgress }
  | {
      readonly status: 'previewing'
      readonly preview: ImportPreview
      readonly chosenName: string
      readonly hasNameConflict: boolean
      readonly nameError?: string
    }
  | {
      readonly status: 'importing'
      readonly preview: ImportPreview
      readonly chosenName: string
    }
  | {
      readonly status: 'done'
      readonly collectionName: string
      readonly resourceCount: number
      /** True when the resources were added to an existing collection rather than a new one. */
      readonly addedToExisting: boolean
    }
  | { readonly status: 'error'; readonly message: string }


interface UseImportCollectionOptions {
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
  /** Where an imported package's files are stored, and removed again if the import fails. */
  readonly fileContent: Pick<FileContentAdapter, 'saveBlob' | 'remove'>
  /**
   * How much room the browser has for those files, and a way to ask it to keep
   * them. A browser that cannot say how much room it has is not a reason to
   * refuse an import.
   */
  readonly storage: Pick<StorageQuotaAdapter, 'estimate' | 'persist'>
}

const REJECTION_MESSAGES: Record<ImportRejection, string> = {
  malformed: "This file isn't a valid Collections Launcher export.",
  'unsupported-format': "This file isn't a Collections Launcher export.",
  'unsupported-version':
    'This file was exported by a newer version of Collections Launcher and can’t be imported here.',
  'too-large':
    'This file is too large to import. An export can hold up to 500 MB of files, each up to 100 MB.',
  damaged:
    'This file is damaged, or was changed after it was exported, so it can’t be imported. Nothing was added.',
}


/**
 * Coordinates the source → preview → confirm import workflow: reading a
 * picked file — a package with its files, or an older export of websites — (or
 * taking a preview built elsewhere), previewing it, letting the user rename a
 * new collection before confirming, and committing either exactly one new
 * collection or — when the preview targets an existing collection — the added
 * resources.
 *
 * Nothing is written until `confirmImport`, and that is all or nothing: a
 * package's files are stored first, then the collections; if anything
 * fails, every file already stored is removed again and the collections are
 * left as they were.
 */
export function useImportCollection({
  state,
  save,
  fileContent,
  storage,
}: UseImportCollectionOptions) {
  const [importState, setImportState] = useState<ImportCollectionState>({
    status: 'idle',
  })
  // Identifies the latest read, so one that finishes after the dialog was
  // closed (or another file picked) cannot bring its preview back.
  const readAttemptRef = useRef(0)

  /** The full name-validity check: basic rules, then the uniqueness rule. */
  function validateChosenName(chosenName: string): string | undefined {
    return (
      getCollectionNameValidationError(chosenName) ??
      (hasCollectionNameConflict(chosenName, state.collections)
        ? NAME_CONFLICT_ERROR
        : undefined)
    )
  }

  /** Reads a picked file and moves to a preview, or to an error state. */
  async function handleFileSelected(file: File): Promise<void> {
    const attempt = ++readAttemptRef.current
    const isCurrent = () => attempt === readAttemptRef.current

    setImportState({ status: 'reading' })

    try {
      const result = await readImportedFile(file, {
        onProgress: progress => {
          if (isCurrent()) {
            setImportState({ status: 'reading', progress })
          }
        },
      })

      if (!isCurrent()) {
        return
      }

      switch (result.status) {
        case 'rejected':
          setImportState({ status: 'error', message: REJECTION_MESSAGES[result.reason] })
          break
        case 'bundle':
          startPreview(buildImportPreview(result.bundle, state))
          break
        case 'package':
          startPreview(buildPackageImportPreview(result.manifest, result.attachments, state))
          break
      }
    } catch (error) {
      if (!isCurrent()) {
        return
      }

      console.error('Could not read the imported file', error)
      setImportState({
        status: 'error',
        message: 'This file could not be read. Try picking it again.',
      })
    }
  }

  /**
   * Why the browser cannot hold the files an import would store, or
   * `undefined` when it can (or cannot say how much room it has).
   */
  async function describeMissingRoom(
    fileContents: readonly ImportedFileContent[],
  ): Promise<string | undefined> {
    const needed = fileContents.reduce((total, file) => total + file.content.size, 0)

    if (needed === 0) {
      return undefined
    }

    const shortfall = getStorageShortfall(needed, await storage.estimate())

    return shortfall
      ? `${describeStorageShortfall(shortfall, 'these files')} Nothing was added.`
      : undefined
  }
  /** Removes files stored by an import that did not complete. Best effort: a failure here is only logged. */
  async function removeStoredFiles(resourceIds: readonly ResourceId[]): Promise<void> {
    await Promise.all(
      resourceIds.map(resourceId =>
        fileContent.remove(resourceId).catch((error: unknown) => {
          console.error(`Could not remove stored content for ${resourceId}`, error)
        }),
      ),
    )
  }

  /**
   * Enters the preview step from an already-built preview. This is the
   * shared entry point for every import source — a picked file goes through
   * `handleFileSelected`, a bookmark folder builds its own preview and calls
   * this directly — so the previewing → importing → done/error flow that
   * follows is one implementation, not one per source.
   */
  function startPreview(preview: ImportPreview): void {
    setImportState({
      status: 'previewing',
      preview,
      chosenName: preview.suggestedName,
      hasNameConflict: preview.hasNameConflict,
    })
  }

  /** Updates the editable name while previewing, re-checking conflicts and any visible error. */
  function updateChosenName(chosenName: string): void {
    setImportState(current => {
      if (current.status !== 'previewing') {
        return current
      }

      return {
        ...current,
        chosenName,
        hasNameConflict: hasCollectionNameConflict(
          chosenName,
          state.collections,
        ),
        nameError: current.nameError
          ? validateChosenName(chosenName)
          : undefined,
      }
    })
  }

  /**
   * Commits the previewed import. For a new collection, first validates the
   * chosen name (basic rules, then uniqueness); when the preview targets an
   * existing collection there is no name to choose, so it goes straight to
   * committing.
   */
  async function confirmImport(): Promise<void> {
    if (importState.status !== 'previewing') {
      return
    }

    const { preview, chosenName } = importState
    const validationError = preview.target
      ? undefined
      : validateChosenName(chosenName)

    if (validationError) {
      setImportState({ ...importState, nameError: validationError })
      return
    }

    setImportState({ status: 'importing', preview, chosenName })

    // Every file stored so far, so a failure part-way can take them back out.
    const storedResourceIds: ResourceId[] = []

    try {
      const prepared = prepareImport(state, preview, chosenName)
      const missingRoom = await describeMissingRoom(prepared.fileContents)

      if (missingRoom) {
        setImportState({ status: 'error', message: missingRoom })
        return
      }

      for (const file of prepared.fileContents) {
        // Recorded first: a write that fails half-way may still have left something.
        storedResourceIds.push(file.resourceId)
        await fileContent.saveBlob(file.resourceId, file.content)
      }

      await save(prepared.state)

      if (prepared.fileContents.length > 0) {
        // These copies are the only ones this browser has of the files, so
        // ask it to keep them. Not awaited: the import is done either way.
        void storage.persist()
      }

      setImportState({
        status: 'done',
        collectionName: preview.target?.name ?? chosenName,
        resourceCount: preview.resources.length,
        addedToExisting: preview.target !== undefined,
      })
    } catch (error) {
      // All or nothing: whatever was stored before the failure comes back out.
      await removeStoredFiles(storedResourceIds)

      if (
        error instanceof CollectionOperationError &&
        error.code === 'DUPLICATE_COLLECTION_NAME'
      ) {
        // The client-side check above should already have caught this —
        // reachable only if another collection was given this exact name
        // between building the preview and confirming. Return to the
        // preview with the name flagged, rather than losing it entirely.
        setImportState({
          status: 'previewing',
          preview,
          chosenName,
          hasNameConflict: true,
          nameError: NAME_CONFLICT_ERROR,
        })
        return
      }

      console.error('Could not import collection', error)
      setImportState({
        status: 'error',
        message: 'The collection could not be imported. Nothing was added. Try again.',
      })
    }
  }

  /** Returns to idle, discarding any read in progress, preview, importing state, or error. */
  function close(): void {
    // A read still running must not bring its preview back after this.
    readAttemptRef.current += 1
    setImportState({ status: 'idle' })
  }

  return {
    importState,
    handleFileSelected,
    startPreview,
    updateChosenName,
    confirmImport,
    close,
  }
}
