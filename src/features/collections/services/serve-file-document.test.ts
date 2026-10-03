import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FileContentError,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import { buildFileDocumentUrl } from '../model/file-document-location'
import {
  createTestCollection,
  createTestFileResource,
  createTestState,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import { serveFileDocument } from './serve-file-document'

afterEach(() => {
  vi.restoreAllMocks()
})

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop'

const PDF = createTestFileResource({
  id: 'pdf-1',
  name: "Résumé (final)",
  mimeType: 'application/pdf',
})
const MARKDOWN = createTestFileResource({
  id: 'md-1',
  name: 'Notes',
  mimeType: 'text/markdown',
})
const WORD = createTestFileResource({
  id: 'doc-1',
  name: 'Contract',
  mimeType: 'application/msword',
})
const WEBSITE = createTestWebsiteResource({ id: 'site-1' })

const STATE = createTestState({
  collections: [
    createTestCollection({ resources: [WEBSITE, PDF, MARKDOWN, WORD] }),
  ],
})

function documentUrl(resourceId: string, fileName = 'x.pdf'): URL {
  return new URL(buildFileDocumentUrl(resourceId, fileName), ORIGIN)
}

function viewerUrl(resourceId: string): string {
  return `${ORIGIN}/viewer.html?resource=${resourceId}&document=unavailable`
}

function createDependencies(
  load: FileContentAdapter['load'] = () =>
    Promise.resolve(new Blob(['%PDF-1.7'], { type: 'application/pdf' })),
) {
  return {
    repository: { load: vi.fn(() => Promise.resolve(STATE)) },
    fileContent: { load: vi.fn(load) },
  }
}

describe('serving a PDF as a document of its own', () => {
  it('answers with the file itself, as a PDF the browser shows inline', async () => {
    const dependencies = createDependencies()

    const response = await serveFileDocument(documentUrl(PDF.id), dependencies)

    expect(response?.status).toBe(200)
    expect(response?.headers.get('Content-Type')).toBe('application/pdf')
    expect(await response?.text()).toBe('%PDF-1.7')
    expect(dependencies.fileContent.load).toHaveBeenCalledExactlyOnceWith(PDF.id)
  })

  it('names the file in the response, escaped for the header', async () => {
    const response = await serveFileDocument(
      documentUrl(PDF.id),
      createDependencies(),
    )

    expect(response?.headers.get('Content-Disposition')).toBe(
      "inline; filename*=UTF-8''R%C3%A9sum%C3%A9%20%28final%29.pdf",
    )
  })

  it('never lets the browser guess a type, and keeps no copy in any cache', async () => {
    const response = await serveFileDocument(
      documentUrl(PDF.id),
      createDependencies(),
    )

    expect(response?.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response?.headers.get('Cache-Control')).toBe('no-store')
  })

  it('serves bytes that claim to be HTML as a PDF all the same', async () => {
    const response = await serveFileDocument(
      documentUrl(PDF.id),
      createDependencies(() =>
        Promise.resolve(
          new Blob(['<script>alert(1)</script>'], { type: 'text/html' }),
        ),
      ),
    )

    expect(response?.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('looks the resource up by id, whatever name the address ends in', async () => {
    const response = await serveFileDocument(
      documentUrl(PDF.id, 'something-else.pdf'),
      createDependencies(),
    )

    expect(response?.status).toBe(200)
  })
})

describe('anything it cannot serve goes to the viewer page', () => {
  it.each([
    ['a Markdown file', MARKDOWN.id],
    ['a Word document', WORD.id],
    ['a website', WEBSITE.id],
    ['a resource that no longer exists', 'gone'],
  ])('redirects %s, reading nothing', async (_label, resourceId) => {
    const dependencies = createDependencies()

    const response = await serveFileDocument(documentUrl(resourceId), dependencies)

    expect(response?.status).toBe(302)
    expect(response?.headers.get('Location')).toBe(viewerUrl(resourceId))
    expect(dependencies.fileContent.load).not.toHaveBeenCalled()
  })

  it.each([['NOT_FOUND' as const], ['PERMISSION_DENIED' as const]])(
    'redirects when the file cannot be read (%s)',
    async code => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

      const response = await serveFileDocument(
        documentUrl(PDF.id),
        createDependencies(() =>
          Promise.reject(new FileContentError(code, 'no')),
        ),
      )

      expect(response?.headers.get('Location')).toBe(viewerUrl(PDF.id))
      expect(errorSpy).not.toHaveBeenCalled()
    },
  )

  it('redirects, and logs, an unexpected failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const dependencies = createDependencies()
    dependencies.repository.load.mockRejectedValue(new Error('storage broke'))

    const response = await serveFileDocument(documentUrl(PDF.id), dependencies)

    expect(response?.headers.get('Location')).toBe(viewerUrl(PDF.id))
    expect(errorSpy).toHaveBeenCalledOnce()
  })
})

describe('other addresses', () => {
  it.each([['/newtab.html'], ['/viewer.html'], ['/file/only-an-id']])(
    'leaves %s to the browser',
    async pathname => {
      const dependencies = createDependencies()

      expect(
        await serveFileDocument(new URL(pathname, ORIGIN), dependencies),
      ).toBeUndefined()
      expect(dependencies.repository.load).not.toHaveBeenCalled()
    },
  )
})
