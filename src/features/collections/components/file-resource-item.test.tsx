// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestFileResource } from '../test/collection.fixtures'
import { FileResourceItem } from './file-resource-item'

afterEach(() => {
  cleanup()
})

describe('FileResourceItem', () => {
  it('shows the name, the kind of file, and its size', () => {
    render(
      <ul>
        <FileResourceItem
          resource={createTestFileResource({
            name: 'Employee handbook',
            mimeType: 'application/pdf',
            sizeBytes: 1_536,
          })}
        />
      </ul>,
    )

    expect(screen.getByText('Employee handbook')).not.toBeNull()
    expect(screen.getByText('PDF document · 1.5 KB')).not.toBeNull()
  })

  it.each([
    ['text/markdown', 'Markdown document'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Word document',
    ],
    [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Excel workbook',
    ],
    [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'PowerPoint presentation',
    ],
  ])('labels %s as %s from the registry, with one component for every type', (mimeType, label) => {
    render(
      <ul>
        <FileResourceItem
          resource={createTestFileResource({ mimeType, sizeBytes: 100 })}
        />
      </ul>,
    )

    expect(screen.getByText(`${label} · 100 B`)).not.toBeNull()
  })

  it('labels a MIME type the registry does not know as a generic file', () => {
    render(
      <ul>
        <FileResourceItem
          resource={createTestFileResource({
            mimeType: 'application/x-something-new',
            sizeBytes: 0,
          })}
        />
      </ul>,
    )

    expect(screen.getByText('File · 0 B')).not.toBeNull()
  })

  it('is display-only, with no open control, until it is given an open handler', () => {
    render(
      <ul>
        <FileResourceItem resource={createTestFileResource({ name: 'Handbook' })} />
      </ul>,
    )

    expect(screen.queryByRole('button', { name: 'Open Handbook' })).toBeNull()
  })

  it('opens the file when given an open handler and clicked', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const resource = createTestFileResource({ name: 'Handbook' })
    render(
      <ul>
        <FileResourceItem resource={resource} onOpen={onOpen} />
      </ul>,
    )

    await user.click(screen.getByRole('button', { name: 'Open Handbook' }))

    expect(onOpen).toHaveBeenCalledWith(resource)
  })

  it('offers no delete control unless it is given a delete handler', () => {
    render(
      <ul>
        <FileResourceItem resource={createTestFileResource({ name: 'Handbook' })} />
      </ul>,
    )

    expect(screen.queryByRole('button', { name: 'Delete Handbook' })).toBeNull()
  })

  it('reports the file to delete', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const resource = createTestFileResource({ name: 'Handbook' })
    render(
      <ul>
        <FileResourceItem resource={resource} onDelete={onDelete} />
      </ul>,
    )

    await user.click(screen.getByRole('button', { name: 'Delete Handbook' }))

    expect(onDelete).toHaveBeenCalledWith(resource)
  })

  it('offers no save control unless it is given a save handler', () => {
    render(
      <ul>
        <FileResourceItem resource={createTestFileResource({ name: 'Handbook' })} />
      </ul>,
    )

    expect(
      screen.queryByRole('button', { name: 'Save a copy of Handbook' }),
    ).toBeNull()
  })

  it('reports the file to save, without also opening it', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onOpen = vi.fn()
    const resource = createTestFileResource({ name: 'Handbook' })
    render(
      <ul>
        <FileResourceItem resource={resource} onOpen={onOpen} onSave={onSave} />
      </ul>,
    )

    await user.click(
      screen.getByRole('button', { name: 'Save a copy of Handbook' }),
    )

    expect(onSave).toHaveBeenCalledExactlyOnceWith(resource)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('shows a reorder handle only when reordering is enabled', () => {
    const resource = createTestFileResource({ name: 'Handbook' })
    const { rerender } = render(
      <ul>
        <FileResourceItem resource={resource} />
      </ul>,
    )

    expect(screen.queryByRole('button', { name: 'Reorder Handbook' })).toBeNull()

    rerender(
      <ul>
        <FileResourceItem resource={resource} isReorderable />
      </ul>,
    )

    expect(screen.getByRole('button', { name: 'Reorder Handbook' })).not.toBeNull()
  })
})
