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
      screen.getByRole('button', { name: 'More options for Handbook' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Save a copy' }))

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

  describe('the "Open with…" menu', () => {
    const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    function renderRow(mimeType: string) {
      const handlers = { onOpen: vi.fn(), onOpenInApp: vi.fn(), onSave: vi.fn() }
      const resource = createTestFileResource({ name: 'Report', mimeType })
      render(
        <ul>
          <FileResourceItem resource={resource} {...handlers} />
        </ul>,
      )

      return { resource, ...handlers }
    }

    async function openMenu(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: 'More options for Report' }))

      return screen.getAllByRole('menuitem').map(item => item.textContent)
    }

    it.each([
      [DOCX, ['Open in browser', 'Open in Word', 'Save a copy']],
      ['application/msword', ['Open in Word', 'Save a copy']],
      ['application/vnd.ms-excel', ['Open in browser', 'Open in Excel', 'Save a copy']],
      [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ['Open in browser', 'Open in PowerPoint', 'Save a copy'],
      ],
      ['application/vnd.ms-powerpoint', ['Open in PowerPoint', 'Save a copy']],
      ['application/pdf', ['Open in browser', 'Save a copy']],
      ['text/markdown', ['Open in browser', 'Save a copy']],
    ])('offers a %s file exactly the ways it can be opened', async (mimeType, expected) => {
      const user = userEvent.setup()
      renderRow(mimeType)

      expect(await openMenu(user)).toEqual(expected)
    })

    it.each([
      ['Open in browser', 'onOpen'],
      ['Open in Word', 'onOpenInApp'],
      ['Save a copy', 'onSave'],
    ] as const)('"%s" calls %s with the file, and nothing else', async (label, handler) => {
      const user = userEvent.setup()
      const handlers = renderRow(DOCX)
      await openMenu(user)

      await user.click(screen.getByRole('menuitem', { name: label }))

      expect(handlers[handler]).toHaveBeenCalledExactlyOnceWith(handlers.resource)
      for (const other of ['onOpen', 'onOpenInApp', 'onSave'] as const) {
        if (other !== handler) {
          expect(handlers[other]).not.toHaveBeenCalled()
        }
      }
      expect(screen.queryByRole('menu')).toBeNull()
    })

    it('still opens the row itself the default way when the row is clicked', async () => {
      const user = userEvent.setup()
      const handlers = renderRow(DOCX)

      await user.click(screen.getByRole('button', { name: 'Open Report' }))

      expect(handlers.onOpen).toHaveBeenCalledExactlyOnceWith(handlers.resource)
      expect(screen.queryByRole('menu')).toBeNull()
    })

    it('leaves out a choice whose handler is not given', async () => {
      const user = userEvent.setup()
      render(
        <ul>
          <FileResourceItem
            resource={createTestFileResource({ name: 'Report', mimeType: DOCX })}
            onSave={() => undefined}
          />
        </ul>,
      )

      expect(await openMenu(user)).toEqual(['Save a copy'])
    })
  })
})
