// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileViewerState } from '../hooks/use-file-viewer'
import type { FileResource } from '../model/collection.types'
import { createTestFileResource } from '../test/collection.fixtures'
import { FileViewer } from './file-viewer'

// The URL the mocked `createObjectURL` hands out. happy-dom tries to load a
// frame's `src` and cannot fetch a `blob:` URL, but treats `about:blank` as
// loaded, so use that: the tests only need to see the value pass through.
const FRAME_URL = 'about:blank'

const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()

// The viewer loads its Markdown renderer on demand. The first import has to
// transform the whole Markdown toolchain, which can take several seconds when
// the machine is busy running every test file at once, so do it once up front
// rather than inside whichever test happens to need it first.
beforeAll(async () => {
  await import('./markdown-view')
}, 60_000)

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
  state: FileViewerState,
  handlers: {
    resource?: FileResource
    onRetry?: () => void
  } = {},
) {
  return render(
    <FileViewer
      resource={handlers.resource ?? PDF}
      state={state}
      onRetry={handlers.onRetry ?? (() => undefined)}
    />,
  )
}

describe('FileViewer page', () => {
  it('is a page, not a pop-up: there is no dialog', () => {
    renderViewer({ status: 'loading' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('main')).not.toBeNull()
  })

  it('says the file is being opened while it loads', () => {
    renderViewer({ status: 'loading' })

    expect(screen.getByRole('status').textContent).toBe('Opening file…')
  })

  it('says the file is being opened while a PDF is on its way to its own address', () => {
    renderViewer({ status: 'opening-document' })

    expect(screen.getByRole('status').textContent).toBe('Opening file…')
  })

  // The page holds the document and nothing of the app's own: the tab title
  // already names the file, and its dashboard row already offers Save a copy.
  describe('no app chrome around the document', () => {
    const notes = createTestFileResource({
      name: 'Notes',
      mimeType: 'text/markdown',
      sizeBytes: 2_048,
    })
    const contract = createTestFileResource({
      name: 'Contract',
      mimeType: 'application/msword',
    })

    const cases: ReadonlyArray<[string, FileResource, FileViewerState]> = [
      ['a Markdown file, loading', notes, { status: 'loading' }],
      [
        'a Markdown file, shown',
        notes,
        { status: 'markdown', text: '# Notes', isTruncated: false },
      ],
      ['a PDF, loading', PDF, { status: 'loading' }],
      ['a PDF, opening', PDF, { status: 'opening-document' }],
      ['a PDF, shown here', PDF, { status: 'pdf', blob: new Blob(['%PDF']) }],
      [
        'a PDF, on an error',
        PDF,
        { status: 'error', code: 'UNAVAILABLE', message: 'Could not.' },
      ],
      ['a Word document', contract, { status: 'unsupported' }],
    ]

    it.each(cases)('has no header, kind, size, or Save a copy for %s', (_label, resource, state) => {
      renderViewer(state, { resource })

      // <header> carries the implicit "banner" landmark role.
      expect(screen.queryByRole('banner')).toBeNull()
      expect(screen.queryByText(/document ·/)).toBeNull()
      expect(screen.queryByText(/2 KB/)).toBeNull()
      expect(screen.queryByRole('button', { name: 'Save a copy' })).toBeNull()
    })
  })

  // Only when its document address could not serve it: normally a PDF leaves
  // this page for that address and is never framed.
  describe('a PDF shown here as a last resort', () => {
    it('shows the bytes in a frame through an object URL, typed as a PDF', () => {
      // The file claims to be something else; the frame must still get a PDF.
      const blob = new Blob(['%PDF-1.7'], { type: 'text/html' })

      renderViewer({ status: 'pdf', blob })

      const frame = screen.getByTitle('Handbook') as HTMLIFrameElement
      expect(frame.tagName).toBe('IFRAME')
      expect(frame.getAttribute('src')).toBe(FRAME_URL)
      expect(createObjectURL).toHaveBeenCalledTimes(1)

      const urlBlob = createObjectURL.mock.calls[0]?.[0] as Blob
      expect(urlBlob.type).toBe('application/pdf')
      expect(urlBlob.size).toBe(blob.size)
    })

    it('releases the object URL when the page goes away', () => {
      const { unmount } = renderViewer({
        status: 'pdf',
        blob: new Blob(['%PDF']),
      })
      expect(revokeObjectURL).not.toHaveBeenCalled()

      unmount()

      expect(revokeObjectURL).toHaveBeenCalledTimes(1)
      expect(revokeObjectURL).toHaveBeenCalledWith(FRAME_URL)
    })

    it('does not make a second object URL for the same file when it re-renders', () => {
      const state: FileViewerState = { status: 'pdf', blob: new Blob(['%PDF']) }
      const { rerender } = renderViewer(state)

      rerender(
        <FileViewer resource={PDF} state={state} onRetry={() => undefined} />,
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
    // the page does (the module itself is already warm, see `beforeAll`).
    const RENDERER_LOAD_TIMEOUT = { timeout: 10_000 }

    it('renders the document as content', async () => {
      renderViewer(
        { status: 'markdown', text: '# Release plan\n\n- ship it', isTruncated: false },
        { resource: notes },
      )

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
      renderViewer(
        { status: 'markdown', text: '# Big', isTruncated: true },
        { resource: notes },
      )

      expect(screen.getByText(/only the first 200 KB is shown/)).not.toBeNull()
      expect(
        await screen.findByRole('heading', { name: 'Big' }, RENDERER_LOAD_TIMEOUT),
      ).not.toBeNull()
    })
  })

  describe('a file that opens in its own application', () => {
    it('says so, and points back to the collections, without offering anything else', () => {
      const contract = createTestFileResource({
        name: 'Contract',
        mimeType: 'application/msword',
      })

      renderViewer({ status: 'unsupported' }, { resource: contract })

      expect(screen.getByRole('status').textContent).toBe(
        '"Contract" opens in its own app. Open it from your collections.',
      )
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
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
        code: 'UNAVAILABLE',
        message: '"Handbook" could not be opened. Try again.',
      })

      expect(screen.getByRole('button', { name: 'Try again' })).not.toBeNull()
    })
  })
})
