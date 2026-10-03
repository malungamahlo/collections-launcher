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

  return {
    fileContent: fileContent as unknown as FileContentAdapter,
    loadSpy: fileContent.load,
    replaceLocation: vi.fn<(url: string) => void>(),
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
      replaceLocation={adapters.replaceLocation}
      search={options.search}
    />,
  )

  return adapters
}

/** The query string the dashboard (or the service worker) navigates here with. */
function searchFor(resourceId: string, documentUnavailable = false): string {
  return new URL(
    buildFileViewerUrl(resourceId, { documentUnavailable }),
    'chrome-extension://x/',
  ).search
}

describe('viewer page', () => {
  it('sends a readable PDF on to be the browser’s own document, frame-free', async () => {
    const adapters = renderViewer({ search: searchFor('pdf-1') })

    await waitFor(() =>
      expect(adapters.replaceLocation).toHaveBeenCalledExactlyOnceWith(
        '/file/pdf-1/Handbook.pdf',
      ),
    )
    expect(adapters.loadSpy).toHaveBeenCalledWith('pdf-1')
    expect(screen.queryByTitle('Handbook')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Opening file…')
  })

  it('frames a PDF its document address could not serve, rather than looping back there', async () => {
    const adapters = renderViewer({ search: searchFor('pdf-1', true) })

    await waitFor(() =>
      expect((screen.getByTitle('Handbook') as HTMLIFrameElement).getAttribute('src')).toBe(
        FRAME_URL,
      ),
    )
    expect(adapters.replaceLocation).not.toHaveBeenCalled()
    expect(document.title).toBe('Handbook')
    expect(screen.queryByRole('banner')).toBeNull()
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

  it('offers Try again after a refusal, and once allowed opens the PDF as a document', async () => {
    const user = userEvent.setup()
    const adapters = createAdapters()
    adapters.loadSpy.mockRejectedValueOnce(
      new FileContentError('PERMISSION_DENIED', 'no'),
    )
    // How the page is reached when a lapsed permission stopped the service worker.
    renderViewer({ search: searchFor('pdf-1', true), adapters })

    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    await waitFor(() =>
      expect(adapters.replaceLocation).toHaveBeenCalledExactlyOnceWith(
        '/file/pdf-1/Handbook.pdf',
      ),
    )
    expect(adapters.loadSpy).toHaveBeenCalledTimes(2)
  })

  it('shows a Markdown file with nothing of the app’s own around it', async () => {
    renderViewer({
      search: searchFor('md-1'),
      adapters: createAdapters(() => Promise.resolve(new Blob(['# Notes']))),
    })

    await screen.findByRole('heading', { name: 'Notes' }, { timeout: 10_000 })

    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.queryByText(/Markdown document/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save a copy' })).toBeNull()
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
      await waitFor(() => expect(adapters.loadSpy).toHaveBeenCalledWith('pdf-1'))
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
