// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenFileViewerState } from '../hooks/use-open-file-resource'
import { createTestFileResource } from '../test/collection.fixtures'
import { FileViewerDialog } from './file-viewer-dialog'

// The URL the mocked `createObjectURL` hands out. happy-dom tries to load a
// frame's `src` and cannot fetch a `blob:` URL, but treats `about:blank` as
// loaded, so use that: the tests only need to see the value pass through.
const FRAME_URL = 'about:blank'

const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()

beforeEach(() => {
  createObjectURL.mockReset().mockReturnValue(FRAME_URL)
  revokeObjectURL.mockReset()
  Object.assign(URL, { createObjectURL, revokeObjectURL })
})

afterEach(() => {
  cleanup()
})

const PDF = createTestFileResource({
  name: 'Handbook',
  mimeType: 'application/pdf',
  sizeBytes: 2_048,
})

function renderViewer(
  state: OpenFileViewerState,
  handlers: { onRetry?: () => void; onClose?: () => void } = {},
) {
  return render(
    <FileViewerDialog
      state={state}
      onRetry={handlers.onRetry ?? (() => undefined)}
      onClose={handlers.onClose ?? (() => undefined)}
    />,
  )
}

describe('FileViewerDialog', () => {
  it('titles the dialog with the file and describes its kind and size', () => {
    renderViewer({ status: 'loading', resource: PDF })

    expect(screen.getByRole('dialog', { name: 'Handbook' })).not.toBeNull()
    expect(screen.getByText('PDF document · 2 KB')).not.toBeNull()
  })

  it('says the file is being opened while it loads', () => {
    renderViewer({ status: 'loading', resource: PDF })

    expect(screen.getByRole('status').textContent).toBe('Opening file…')
  })

  it('closes from its Close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderViewer({ status: 'loading', resource: PDF }, { onClose })

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on the native cancel event (Escape)', () => {
    const onClose = vi.fn()
    renderViewer({ status: 'loading', resource: PDF }, { onClose })

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('a PDF', () => {
    it('shows the bytes in a frame through an object URL, typed as a PDF', () => {
      // The file claims to be something else; the frame must still get a PDF.
      const blob = new Blob(['%PDF-1.7'], { type: 'text/html' })

      renderViewer({ status: 'pdf', resource: PDF, blob })

      const frame = screen.getByTitle('Handbook') as HTMLIFrameElement
      expect(frame.tagName).toBe('IFRAME')
      expect(frame.getAttribute('src')).toBe(FRAME_URL)
      expect(createObjectURL).toHaveBeenCalledTimes(1)

      const urlBlob = createObjectURL.mock.calls[0]?.[0] as Blob
      expect(urlBlob.type).toBe('application/pdf')
      expect(urlBlob.size).toBe(blob.size)
    })

    it('releases the object URL when the viewer closes', () => {
      const { unmount } = renderViewer({
        status: 'pdf',
        resource: PDF,
        blob: new Blob(['%PDF']),
      })
      expect(revokeObjectURL).not.toHaveBeenCalled()

      unmount()

      expect(revokeObjectURL).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith(FRAME_URL)
    })

    it('does not make a second object URL for the same file when it re-renders', () => {
      const state: OpenFileViewerState = {
        status: 'pdf',
        resource: PDF,
        blob: new Blob(['%PDF']),
      }
      const { rerender } = renderViewer(state)

      rerender(
        <FileViewerDialog
          state={state}
          onRetry={() => undefined}
          onClose={() => undefined}
        />,
      )

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).not.toHaveBeenCalled()
    })
  })

  describe('a Markdown document', () => {
    const notes = createTestFileResource({
      name: 'Notes',
      mimeType: 'text/markdown',
    })

    // The renderer is loaded on demand, so its content appears a moment after
    // the dialog does. The first import has to transform the whole Markdown
    // toolchain, which can take longer than a `findBy`'s default second when
    // the machine is busy running every test file at once — so wait longer.
    const RENDERER_LOAD_TIMEOUT = { timeout: 10_000 }

    it('renders the document as content', async () => {
      renderViewer({
        status: 'markdown',
        resource: notes,
        text: '# Release plan\n\n- ship it',
        isTruncated: false,
      })

      expect(
        await screen.findByRole(
          'heading',
          { name: 'Release plan' },
          RENDERER_LOAD_TIMEOUT,
        ),
      ).not.toBeNull()
      expect(screen.getByText('ship it')).not.toBeNull()
      expect(screen.queryByText(/only the first 200 KB is shown/)).toBeNull()
    })

    it('says so when only the start of a large document is shown', async () => {
      renderViewer({
        status: 'markdown',
        resource: notes,
        text: '# Big',
        isTruncated: true,
      })

      expect(screen.getByText(/only the first 200 KB is shown/)).not.toBeNull()
      expect(
        await screen.findByRole('heading', { name: 'Big' }, RENDERER_LOAD_TIMEOUT),
      ).not.toBeNull()
    })
  })

  describe('a file the dashboard cannot show', () => {
    const contract = createTestFileResource({
      name: 'Contract',
      mimeType: 'application/msword',
    })

    it('explains why, without offering to download or copy it', () => {
      renderViewer({ status: 'unsupported', resource: contract })

      expect(screen.getByRole('status').textContent).toContain(
        "Word documents can't be previewed in the dashboard yet",
      )
      expect(screen.getByRole('status').textContent).toContain('second copy')
      expect(screen.queryByRole('button', { name: /download|save|try again/i })).toBeNull()
      expect(createObjectURL).not.toHaveBeenCalled()
    })
  })

  describe('a file that could not be read', () => {
    it('shows the reason as an alert and offers to try again', async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()
      renderViewer(
        {
          status: 'error',
          resource: PDF,
          code: 'PERMISSION_DENIED',
          message: 'Access to "Handbook" was not granted.',
        },
        { onRetry },
      )

      expect(screen.getByRole('alert').textContent).toBe(
        'Access to "Handbook" was not granted.',
      )

      await user.click(screen.getByRole('button', { name: 'Try again' }))

      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('offers no retry when the file is gone, since trying again cannot help', () => {
      renderViewer({
        status: 'error',
        resource: PDF,
        code: 'NOT_FOUND',
        message: '"Handbook" could not be found.',
      })

      expect(screen.getByRole('alert').textContent).toBe(
        '"Handbook" could not be found.',
      )
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    })

    it('offers a retry when the file was unavailable', () => {
      renderViewer({
        status: 'error',
        resource: PDF,
        code: 'UNAVAILABLE',
        message: '"Handbook" could not be opened. Try again.',
      })

      expect(screen.getByRole('button', { name: 'Try again' })).not.toBeNull()
    })
  })
})
