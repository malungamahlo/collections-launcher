// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { secureRenderedDocument } from './secure-rendered-document'

function drawn(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html

  return root
}

describe('secureRenderedDocument', () => {
  it('opens web and mail links in a new tab, cut off from this page', () => {
    const root = drawn('<a href="https://example.com/">web</a><a href="mailto:a@b.c">mail</a>')

    secureRenderedDocument(root)

    for (const link of Array.from(root.querySelectorAll('a'))) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })

  it('keeps a link to another place in the same document', () => {
    const root = drawn('<a href="#_Toc1">Contents</a>')

    secureRenderedDocument(root)

    expect(root.querySelector('a')?.getAttribute('href')).toBe('#_Toc1')
  })

  it.each([['javascript:alert(1)'], ['JavaScript:alert(1)'], ['file:///C:/x'], ['chrome://settings'], ['data:text/html,x']])(
    'leaves a %s link as plain text',
    href => {
      const root = drawn(`<a href="${href}">click</a>`)

      secureRenderedDocument(root)

      expect(root.querySelector('a')?.hasAttribute('href')).toBe(false)
      expect(root.textContent).toBe('click')
    },
  )

  it('removes pictures that would load from anywhere but the document itself', () => {
    const root = drawn(
      '<img src="blob:chrome-extension://x/1"><img src="data:image/png;base64,AA=="><img src="https://tracker.example/p.png"><img>',
    )

    secureRenderedDocument(root)

    expect(Array.from(root.querySelectorAll('img')).map(image => image.getAttribute('src'))).toEqual([
      'blob:chrome-extension://x/1',
      'data:image/png;base64,AA==',
    ])
  })

  it('removes anything that could load or run something', () => {
    const root = drawn(
      '<p>Kept</p><iframe src="https://x"></iframe><object data="x"></object><embed src="x"><form action="https://x"></form><link rel="stylesheet" href="https://x"><base href="https://x/">',
    )

    secureRenderedDocument(root)

    expect(root.innerHTML).toBe('<p>Kept</p>')
  })
})
