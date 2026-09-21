// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MarkdownView } from './markdown-view'

afterEach(cleanup)

function renderMarkdown(text: string): HTMLElement {
  return render(<MarkdownView text={text} />).container
}

describe('MarkdownView rendering', () => {
  it('renders headings, emphasis, and paragraphs', () => {
    const container = renderMarkdown('# Title\n\nSome **bold** and *italic* text.')

    expect(container.querySelector('h1')?.textContent).toBe('Title')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
  })

  it('renders ordered and unordered lists', () => {
    const container = renderMarkdown('- one\n- two\n\n1. first\n2. second')

    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(container.querySelectorAll('ol > li')).toHaveLength(2)
  })

  it('renders inline code and fenced code blocks', () => {
    const container = renderMarkdown('Use `npm test`.\n\n```ts\nconst x = 1\n```')

    expect(container.querySelectorAll('code')).toHaveLength(2)
    expect(container.querySelector('pre code')?.textContent).toContain('const x = 1')
  })

  it('renders GitHub-flavoured tables', () => {
    const container = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')

    expect(container.querySelectorAll('th')).toHaveLength(2)
    expect(container.querySelectorAll('td')).toHaveLength(2)
  })

  it('renders task lists as read-only checkboxes', () => {
    const container = renderMarkdown('- [x] done\n- [ ] todo')
    const boxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')

    expect(boxes).toHaveLength(2)
    expect(boxes[0]?.checked).toBe(true)
    expect(boxes[1]?.checked).toBe(false)
    expect([...boxes].every(box => box.disabled)).toBe(true)
  })

  it('renders an empty document without failing', () => {
    expect(renderMarkdown('').textContent).toBe('')
  })
})

describe('MarkdownView links', () => {
  it('opens a web link in a new tab that cannot reach back to the dashboard', () => {
    const link = renderMarkdown('[Docs](https://example.com/docs)').querySelector('a')

    expect(link?.getAttribute('href')).toBe('https://example.com/docs')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('keeps mailto links', () => {
    const link = renderMarkdown('[Write](mailto:a@example.com)').querySelector('a')

    expect(link?.getAttribute('href')).toBe('mailto:a@example.com')
  })

  it.each([
    ['javascript:', '[click](javascript:alert(1))'],
    ['data:', '[click](data:text/html,<script>alert(1)</script>)'],
    ['vbscript:', '[click](vbscript:msgbox(1))'],
    ['file:', '[click](file:///C:/Windows/system.ini)'],
    ['chrome-extension:', '[click](chrome-extension://abc/newtab.html)'],
    ['a relative path', '[other](./other.md)'],
    ['a root-relative path', '[other](/newtab.html)'],
    ['a page anchor', '[section](#section)'],
  ])('drops a link to %s but keeps its text', (_label, markdown) => {
    const container = renderMarkdown(markdown)

    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toMatch(/click|other|section/)
  })
})

describe('MarkdownView untrusted content', () => {
  it('never turns raw HTML into elements', () => {
    const container = renderMarkdown(
      [
        '<script>window.hacked = true</script>',
        '',
        '<img src="https://evil.example/pixel.png" onerror="window.hacked = true">',
        '',
        '<iframe src="https://evil.example"></iframe>',
        '',
        '<a href="javascript:alert(1)" onclick="alert(2)">x</a>',
      ].join('\n'),
    )

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('[onerror], [onclick]')).toBeNull()
    expect((window as unknown as { hacked?: boolean }).hacked).toBeUndefined()
  })

  it('drops raw HTML instead of showing its source as visible text', () => {
    const container = renderMarkdown(
      [
        '# Title',
        '',
        '<!-- a comment -->',
        '',
        '<p align="center"><img src="https://evil.example/banner.png"></p>',
        '',
        'After.',
      ].join('\n'),
    )

    // Only the two real blocks remain: no comment text, no tag source.
    expect(container.textContent.replace(/\s+/g, ' ').trim()).toBe('Title After.')
  })

  it('keeps the text between inline HTML tags', () => {
    const container = renderMarkdown('Press <kbd>Ctrl</kbd> and <b>S</b>.')

    expect(container.textContent).toBe('Press Ctrl and S.')
    expect(container.querySelector('kbd, b')).toBeNull()
  })

  it('does not load images, so opening a file cannot ping a remote server', () => {
    const container = renderMarkdown(
      '![tracking pixel](https://evil.example/pixel.png)\n\n![](https://evil.example/2.png)',
    )

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('[Image: tracking pixel]')
    expect(container.textContent).toContain('[Image]')
  })

  it('does not load an image nested in a link either', () => {
    const container = renderMarkdown(
      '[![badge](https://evil.example/badge.svg)](https://example.com)',
    )

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')?.textContent).toBe('[Image: badge]')
  })

  it('does not run a data: image', () => {
    const container = renderMarkdown('![x](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)')

    expect(container.querySelector('img')).toBeNull()
  })
})
