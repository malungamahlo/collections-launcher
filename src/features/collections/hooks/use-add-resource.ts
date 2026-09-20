import { useState } from 'react'
import type { Collection, CollectionId } from '../model/collection.types'

/** The kinds of resource the add dialog can create. */
export type AddResourceType = 'website' | 'file'

/** The part of the website hook this coordinator needs: creating (not editing). */
interface WebsiteCreateControls {
  readonly editor: { readonly mode: 'create' | 'edit' } | null
  readonly formValues: { readonly collectionId: CollectionId }
  readonly isSaving: boolean
  openCreate(collection: Collection): void
  closeEditor(): void
}

/** The part of the file hook this coordinator needs. */
interface FileCreateControls {
  readonly isOpen: boolean
  readonly formValues: { readonly collectionId: CollectionId }
  readonly isSaving: boolean
  readonly isPicking: boolean
  openCreate(collection: Collection): void
  close(): void
}

interface UseAddResourceOptions {
  readonly websites: WebsiteCreateControls
  readonly files: FileCreateControls
  readonly collections: readonly Collection[]
}

/**
 * Presents adding a website and adding a file as one "Add resource" flow.
 *
 * It owns no persistence or validation: each kind of resource still has its
 * own hook and form, and this only decides which of them is open. Choosing a
 * different type closes one form and opens the other for the same collection —
 * that collection is the only thing carried across, so a typed name, a URL, or
 * a chosen file is reset rather than half-translated between two different
 * forms.
 */
export function useAddResource({
  websites,
  files,
  collections,
}: UseAddResourceOptions) {
  const [type, setType] = useState<AddResourceType>('website')

  // Editing a website has its own dialog; only *creating* one belongs here.
  const isOpen = websites.editor?.mode === 'create' || files.isOpen
  const isBusy = websites.isSaving || files.isSaving || files.isPicking

  /** Opens the dialog on the website form, for the collection whose card was used. */
  function open(collection: Collection): void {
    setType('website')
    websites.openCreate(collection)
  }

  /** Switches to another type for the same collection; ignored while busy. */
  function selectType(nextType: AddResourceType): void {
    if (nextType === type || isBusy) {
      return
    }

    const collectionId =
      type === 'website'
        ? websites.formValues.collectionId
        : files.formValues.collectionId
    const collection = collections.find(
      candidate => candidate.id === collectionId,
    )

    // The collection was deleted while the dialog was open; there is nothing
    // to switch for, so stay on the current form.
    if (!collection) {
      return
    }

    if (nextType === 'file') {
      websites.closeEditor()
      files.openCreate(collection)
    } else {
      files.close()
      websites.openCreate(collection)
    }

    setType(nextType)
  }

  /** Closes whichever form is open. Each hook itself refuses while it is saving. */
  function close(): void {
    websites.closeEditor()
    files.close()
  }

  return { isOpen, type, isBusy, open, selectType, close }
}
