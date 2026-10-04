// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImportCollectionState } from '../hooks/use-import-collection'
import type { ImportPreviewResource } from '../services/import-collection-bundle'
import { ImportCollectionDialog } from './import-collection-dialog'

afterEach(() => {
  cleanup()
})

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function file(name: string, mimeType: string, sizeBytes: number): ImportPreviewResource {
  return { type: 'file', name, mimeType, sizeBytes, content: new Blob() }
}

function previewing(resources: readonly ImportPreviewResource[]): ImportCollectionState {
  return {
    status: 'previewing',
    chosenName: 'Study pack',
    hasNameConflict: false,
    preview: {
      suggestedName: 'Study pack',
      hasNameConflict: false,
      resources,
      skippedDuplicateCount: 0,
      skippedInvalidCount: 0,
    },
  }
}

function renderDialog(importState: ImportCollectionState, onClose = vi.fn()) {
  render(
    <ImportCollectionDialog
      importState={importState as Exclude<ImportCollectionState, { status: 'idle' }>}
      onChosenNameChange={() => undefined}
      onConfirm={() => undefined}
      onClose={onClose}
    />,
  )

  return { onClose }
}

describe('ImportCollectionDialog with files', () => {
  it('lists a file with its kind and size, and a website with its address, in order', () => {
    renderDialog(
      previewing([
        { name: 'GitHub', url: 'https://github.com/' },
        file('Handbook', 'application/pdf', 2_048),
        file('Contract', DOCX, 5 * 1024 * 1024),
      ]),
    )

    expect(screen.getByText('3 resources')).not.toBeNull()
    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'GitHub — https://github.com/',
      'Handbook — PDF document · 2 KB',
      'Contract — Word document · 5 MB',
    ])
  })

  it('says how many files, and how much, will be stored in the browser', () => {
    renderDialog(
      previewing([
        file('Handbook', 'application/pdf', 1024 * 1024),
        file('Contract', DOCX, 2 * 1024 * 1024),
      ]),
    )

    expect(screen.getByText('2 files (3 MB) will be stored in this browser.')).not.toBeNull()
  })

  it('says nothing about storing files when there are only websites', () => {
    renderDialog(previewing([{ name: 'GitHub', url: 'https://github.com/' }]))

    expect(screen.queryByText(/will be stored in this browser/)).toBeNull()
  })

  it('lists two files that share a name’s start without mixing them up', () => {
    renderDialog(
      previewing([file('Notes', 'text/markdown', 10), file('Notes 2', 'text/markdown', 20)]),
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('names a file of an unknown type plainly', () => {
    renderDialog(previewing([file('Mystery', 'application/x-something-new', 100)]))

    expect(screen.getByRole('listitem').textContent).toBe('Mystery — File · 100 B')
  })
})

describe('ImportCollectionDialog while a file is read', () => {
  it('says the file is being checked before anything is added', () => {
    renderDialog({ status: 'reading' })

    expect(screen.getByRole('heading', { name: 'Reading file…' })).not.toBeNull()
    expect(screen.getByRole('status').textContent).toBe(
      'Checking the file before anything is added.',
    )
  })

  it('reports how many of a package’s files have been checked', () => {
    renderDialog({ status: 'reading', progress: { filesRead: 2, totalFiles: 5 } })

    expect(screen.getByRole('status').textContent).toBe('Checking 5 files: 2 of 5 done.')
  })

  it('can be cancelled', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog({ status: 'reading' })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
  })
})
