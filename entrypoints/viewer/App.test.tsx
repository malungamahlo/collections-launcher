// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionsState } from '@app/features/collections/model/collection.types'
import { buildFileViewerUrl } from '@app/features/collections/model/file-viewer-location'
import type { CollectionsRepository } from '@app/features/collections/storage/collections.repository'
import {
  createTestCollection,
  createTestFileResource,
  createTestState,
  createTestWebsiteResource,
} from '@app/features/collections/test/collection.fixtures'
import {
  FileContentError,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import type { FileDownloadAdapter } from '@app/platform/browser/file-download.adapter'
import App from './App'

// happy-dom cannot load a `blob:` frame source but treats `about:blank` as loaded.
const FRAME_URL = 'about:blank'

// The viewer loads its Markdown renderer on demand; the first import transforms
// the whole Markdown toolchain, which is slow when every test file runs at once.
// Do it once up front rather than inside whichever test needs it first.
beforeAll(async () => {
  await import('@app/features/collections/components/markdown-view')
}, 60_000)

beforeEach(() => {
  Object.assign(URL, {
    createObjectURL: vi.fn().mockReturnValue(FRAME_URL),
    revokeObjectURL: vi.fn(),
  })
  document.title = 'Collections Launcher'
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PDF = createTestFileResource({
  id: 'pdf-1',
  name: 'Handbook',
  mimeType: 'application/pdf',
})
const MARKDOWN = createTestFileResource({
  id: 'md-1',
  name: 'Notes',
  mimeType: 'text/markdown',
})
const WEBSITE = createTestWebsiteResource({ id: 'site-1', name: 'GitHub' })
const STATE: CollectionsState = createTestState({
  collections: [
    createTestCollection({ resources: [WEBSITE, PDF, MARKDOWN] }),
  ],
})

function createRepository(state: CollectionsState): CollectionsRepository {
  return {
    load: vi.fn().mockResolvedValue(state),
    save: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  }
}

function createAdapters(load: () => Promise<Blob> = () => Promise.resolve(new Blob(['%PDF-1.7']))) {
  const fileContent = { load: vi.fn(load) }
  const download = vi.fn<FileDownloadAdapter['download']>()

  return {
    fileContent: fileContent as unknown as FileContentAdapter,
    loadSpy: fileContent.load,
    fileDownload: { download } satisfies FileDownloadAdapter,
    download,
  }
}

function renderViewer(options: {
  search: string
  state?: CollectionsState
  repository?: CollectionsRepository
  adapters?: ReturnType<typeof createAdapters>
}) {
  const adapters = options.adapters ?? createAdapters()

  render(
    <App
      repository={options.repository ?? createRepository(options.state ?? STATE)}
      fileContent={adapters.fileContent}
      fileDownload={adapters.fileDownload}
      search={options.search}
    />,
  )

  return adapters
}

/** The query string the dashboard navigates here with. */
function searchFor(resourceId: string): string {
  return new URL(buildFileViewerUrl(resourceId), 'chrome-extension://x/').search
}

describe('viewer page', () => {
  it('shows a PDF resource on a page of its own, titling the tab after it', async () => {
    const adapters = renderViewer({ search: searchFor('pdf-1') })

    await waitFor(() =>
      expect((screen.getByTitle('Handbook') as HTMLIFrameElement).getAttribute('src')).toBe(
        FRAME_URL,
      ),
    )
    expect(adapters.loadSpy).toHaveBeenCalledWith('pdf-1')
    // The tab is titled with the file, and there is no header repeating that
    // (or anything else) above the browser's own PDF viewer — and nothing is a pop-up.
    expect(document.title).toBe('Handbook')
    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders a Markdown resource as a document', async () => {
    renderViewer({
      search: searchFor('md-1'),
      adapters: createAdapters(() =>
        Promise.resolve(new Blob(['# Release plan\n\n- ship it'])),
      ),
    })

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Release plan' },
        { timeout: 10_000 },
      ),
    ).not.toBeNull()
    expect(document.title).toBe('Notes')
  })

  it('offers Try again after a refusal, and shows the file once it is allowed', async () => {
    const user = userEvent.setup()
    const adapters = createAdapters()
    adapters.loadSpy.mockRejectedValueOnce(
      new FileContentError('PERMISSION_DENIED', 'no'),
    )
    renderViewer({ search: searchFor('pdf-1'), adapters })

    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(screen.getByTitle('Handbook')).not.toBeNull())
    expect(adapters.loadSpy).toHaveBeenCalledTimes(2)
  })

  // Save a copy is left out for a PDF (the browser's own viewer already has a
  // download control) — see file-viewer.test.tsx — so this exercises a
  // Markdown resource, which still offers it.
  it('saves a copy from its header, named after the file with its extension', async () => {
    const user = userEvent.setup()
    const content = new Blob(['# Notes'], { type: 'text/markdown' })
    const adapters = createAdapters(() => Promise.resolve(content))
    renderViewer({ search: searchFor('md-1'), adapters })

    await user.click(await screen.findByRole('button', { name: 'Save a copy' }))

    await waitFor(() =>
      expect(adapters.download).toHaveBeenCalledExactlyOnceWith(
        'Notes.md',
        content,
      ),
    )
  })

  it('has no header, or Save a copy button, for a PDF — the browser’s own viewer already has both', async () => {
    renderViewer({ search: searchFor('pdf-1') })

    await screen.findByTitle('Handbook')

    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save a copy' })).toBeNull()
  })

  it('says why a copy could not be saved', async () => {
    const user = userEvent.setup()
    const adapters = createAdapters()
    renderViewer({ search: searchFor('md-1'), adapters })
    // Lets the page's own first load claim its call before queuing the next
    // one to fail — the save button's click triggers a second, separate load.
    await waitFor(() => expect(adapters.loadSpy).toHaveBeenCalledTimes(1))
    adapters.loadSpy.mockRejectedValueOnce(
      new FileContentError('NOT_FOUND', 'gone'),
    )

    await user.click(screen.getByRole('button', { name: 'Save a copy' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'nothing to save',
    )
    expect(adapters.download).not.toHaveBeenCalled()
  })

  describe('when there is nothing to show', () => {
    it('says so when no resource was named', () => {
      renderViewer({ search: '' })

      expect(screen.getByRole('status').textContent).toContain(
        'No file was chosen',
      )
    })

    it('says so when the resource is no longer in the collections', async () => {
      renderViewer({ search: searchFor('deleted-long-ago') })

      expect(
        await screen.findByText('This file is no longer in your collections.'),
      ).not.toBeNull()
    })

    it('does not treat a website as a file', async () => {
      const adapters = renderViewer({ search: searchFor('site-1') })

      expect(
        await screen.findByText('This file is no longer in your collections.'),
      ).not.toBeNull()
      expect(adapters.loadSpy).not.toHaveBeenCalled()
    })

    it('says the collections are loading, then nothing is read until they are', async () => {
      const repository = createRepository(STATE)
      let release!: (state: CollectionsState) => void
      vi.mocked(repository.load).mockReturnValue(
        new Promise<CollectionsState>(resolve => {
          release = resolve
        }),
      )
      const adapters = renderViewer({ search: searchFor('pdf-1'), repository })

      expect(screen.getByRole('status').textContent).toBe('Loading…')
      expect(adapters.loadSpy).not.toHaveBeenCalled()

      release(STATE)
      expect(await screen.findByTitle('Handbook')).not.toBeNull()
    })

    it('reports collections that could not be loaded', async () => {
      const repository = createRepository(STATE)
      vi.mocked(repository.load).mockRejectedValue(new Error('storage down'))
      renderViewer({ search: searchFor('pdf-1'), repository })

      expect((await screen.findByRole('alert')).textContent).toContain(
        'could not be loaded',
      )
    })
  })
})
