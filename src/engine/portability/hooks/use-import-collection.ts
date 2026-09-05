import { useState } from 'react'
import { getCollectionNameValidationError } from '@app/features/collections/model/collection.validation'
import { CollectionOperationError } from '@app/features/collections/model/collection.operations'
import type { CollectionsState } from '@app/features/collections/model/collection.types'
import {
  applyImportPreview,
  buildImportPreview,
  hasCollectionNameConflict,
  type ImportPreview,
} from '../services/import-collection-bundle'
import { parseImportedBundleText } from '../validation/bundle.validation'

const NAME_CONFLICT_ERROR = 'A collection with this name already exists.'

/** Explicit states the import workflow moves through, one file at a time. */
export type ImportCollectionState =
  | { readonly status: 'idle' }
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
    }
  | { readonly status: 'error'; readonly message: string }

interface UseImportCollectionOptions {
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
}

const PARSE_ERROR_MESSAGES: Record<
  'malformed' | 'unsupported-format' | 'unsupported-version',
  string
> = {
  malformed: "This file isn't a valid Collections Launcher export.",
  'unsupported-format': "This file isn't a Collections Launcher export.",
  'unsupported-version':
    'This file was exported by a newer version of Collections Launcher and can’t be imported here.',
}

/**
 * Coordinates the file → preview → confirm import workflow: reading the
 * picked file's text, parsing and previewing it, letting the user rename
 * the collection before confirming, and committing exactly one new
 * collection. Nothing is written to state until `confirmImport` succeeds.
 */
export function useImportCollection({ state, save }: UseImportCollectionOptions) {
  const [importState, setImportState] = useState<ImportCollectionState>({
    status: 'idle',
  })

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
    let text: string

    try {
      text = await file.text()
    } catch (error) {
      console.error('Could not read the imported file', error)
      setImportState({
        status: 'error',
        message: 'This file could not be read. Try picking it again.',
      })
      return
    }

    const parsed = parseImportedBundleText(text)

    if (parsed.status !== 'valid') {
      setImportState({
        status: 'error',
        message: PARSE_ERROR_MESSAGES[parsed.status],
      })
      return
    }

    const preview = buildImportPreview(parsed.bundle, state)

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

  /** Validates the chosen name (basic rules, then uniqueness), then commits the previewed import. */
  async function confirmImport(): Promise<void> {
    if (importState.status !== 'previewing') {
      return
    }

    const { preview, chosenName } = importState
    const validationError = validateChosenName(chosenName)

    if (validationError) {
      setImportState({ ...importState, nameError: validationError })
      return
    }

    setImportState({ status: 'importing', preview, chosenName })

    try {
      const nextState = applyImportPreview(state, preview, chosenName)
      await save(nextState)
      setImportState({
        status: 'done',
        collectionName: chosenName,
        resourceCount: preview.resources.length,
      })
    } catch (error) {
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
        message: 'The collection could not be imported. Try again.',
      })
    }
  }

  /** Returns to idle, discarding any preview, importing state, or error. */
  function close(): void {
    setImportState({ status: 'idle' })
  }

  return { importState, handleFileSelected, updateChosenName, confirmImport, close }
}
