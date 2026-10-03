// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WordView } from './word-view'

// The drawing library itself is exercised in real Chromium (Playwright); here
// it is replaced so the test sees exactly what this component does around it.
const renderAsync = vi.hoisted(() => vi.fn())
vi.mock('docx-preview', () => ({ renderAsync }))

afterEach(() => {
  cleanup()
  renderAsync.mockReset()
})

function shadowOf(): ShadowRoot {
  const host = screen.getByTestId('word-document')
  const shadow = host.shadowRoot

  if (!shadow) {
    throw new Error('The document is not drawn in a shadow root.')
  }

  return shadow
}

describe('WordView', () => {
  it('draws the document inside a shadow root, apart from the app’s own styles', async () => {
    renderAsync.mockImplementation(async (_blob: Blob, body: HTMLElement) => {
      body.innerHTML = '<section class="docx"><p>Key Questions and Metrics</p></section>'
    })
    const blob = new Blob(['docx'])

    render(<WordView blob={blob} onError={() => undefined} />)

    await waitFor(() => expect(shadowOf().textContent).toContain('Key Questions and Metrics'))
    expect(renderAsync.mock.calls[0]?.[0]).toBe(blob)
    // Embedded web pages inside the document are never drawn.
    expect(renderAsync.mock.calls[0]?.[3]).toMatchObject({ renderAltChunks: false })
    // Nothing of the document is in the page's own DOM.
    expect(document.body.textContent).not.toContain('Key Questions')
  })

  it('makes the drawn document safe once it is drawn', async () => {
    renderAsync.mockImplementation(async (_blob: Blob, body: HTMLElement) => {
      body.innerHTML =
        '<a href="javascript:alert(1)">bad</a><a href="https://example.com/">good</a><img src="https://tracker.example/p.png"><iframe></iframe>'
    })

    render(<WordView blob={new Blob(['docx'])} onError={() => undefined} />)

    await waitFor(() => expect(shadowOf().querySelector('a[target="_blank"]')).not.toBeNull())
    const links = Array.from(shadowOf().querySelectorAll('a'))
    expect(links.map(link => link.getAttribute('href'))).toEqual([null, 'https://example.com/'])
    expect(shadowOf().querySelector('img, iframe')).toBeNull()
  })

  it('says when the document could not be drawn', async () => {
    renderAsync.mockRejectedValue(new Error('corrupt'))
    const onError = vi.fn()

    render(<WordView blob={new Blob(['docx'])} onError={onError} />)

    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
  })
})
