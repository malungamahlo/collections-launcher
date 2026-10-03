// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Presentation, Slide, TextRun } from '../documents/presentation.types'
import { PresentationView } from './presentation-view'

const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()

beforeEach(() => {
  let next = 0
  createObjectURL.mockReset().mockImplementation(() => `blob:test/${(next += 1)}`)
  revokeObjectURL.mockReset()
  Object.assign(URL, { createObjectURL, revokeObjectURL })
})

afterEach(() => {
  cleanup()
})

const FRAME = { x: 914_400, y: 457_200, width: 4_572_000, height: 914_400, rotation: 0 }

function run(text: string, extra: Partial<TextRun> = {}): TextRun {
  return { text, sizePt: 24, bold: false, italic: false, underline: false, ...extra }
}

function deck(slides: Slide[], extra: Partial<Presentation> = {}): Presentation {
  return {
    width: 9_144_000,
    height: 5_143_500,
    slides,
    totalSlides: slides.length,
    isTruncated: false,
    ...extra,
  }
}

const TITLE_SLIDE: Slide = {
  number: 1,
  background: { kind: 'color', color: '#112233' },
  elements: [
    {
      kind: 'shape',
      frame: FRAME,
      geometry: 'rectangle',
      text: {
        anchor: 'middle',
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
        paragraphs: [
          { runs: [run('Hotel Reservation', { bold: true, color: '#ff0000', font: 'Maven Pro' })], level: 0, align: 'center', emptySizePt: 24 },
          { runs: [run('First point')], level: 0, align: 'left', bullet: '•', emptySizePt: 24 },
        ],
      },
    },
  ],
}

describe('PresentationView', () => {
  it('draws each slide, labelled with its number', () => {
    render(<PresentationView presentation={deck([TITLE_SLIDE, { ...TITLE_SLIDE, number: 2 }])} />)

    expect(
      screen.getAllByRole('region').map(slide => slide.getAttribute('aria-label')),
    ).toEqual(['Slide 1 of 2', 'Slide 2 of 2'])
  })

  it('keeps a slide’s proportions and places its text where the deck puts it', () => {
    render(<PresentationView presentation={deck([TITLE_SLIDE])} />)

    const slide = screen.getByRole('region', { name: 'Slide 1 of 1' }).firstElementChild as HTMLElement
    expect(slide.style.aspectRatio).toBe('9144000 / 5143500')

    const title = screen.getByText('Hotel Reservation')
    const box = title.closest('p')?.parentElement?.parentElement as HTMLElement
    expect(box.style.left).toBe('10%')
    expect(box.style.width).toBe('50%')
  })

  it('styles text as the deck does', () => {
    render(<PresentationView presentation={deck([TITLE_SLIDE])} />)

    const title = screen.getByText('Hotel Reservation').parentElement as HTMLElement
    expect(title.style.fontWeight).toBe('700')
    expect(title.style.color).toBe('#ff0000')
    expect(title.style.fontFamily).toContain('Maven Pro')
    // Its size is a share of the slide's width (`cqw`), a unit the test DOM
    // drops; the Playwright tests check it in real Chromium.
  })

  it('shows a paragraph’s bullet', () => {
    render(<PresentationView presentation={deck([TITLE_SLIDE])} />)

    expect(screen.getByText('•')).not.toBeNull()
  })

  it('shows a picture through an object URL it releases when the page goes', () => {
    const image = new Blob(['png'], { type: 'image/png' })
    const { unmount, container } = render(
      <PresentationView
        presentation={deck([
          {
            number: 1,
            background: { kind: 'image', image },
            elements: [{ kind: 'picture', frame: FRAME, image }],
          },
        ])}
      />,
    )

    expect(Array.from(container.querySelectorAll('img')).map(element => element.getAttribute('src'))).toEqual([
      'blob:test/1',
      'blob:test/2',
    ])

    unmount()

    expect(revokeObjectURL.mock.calls.map(([url]) => url as string).sort()).toEqual([
      'blob:test/1',
      'blob:test/2',
    ])
  })

  it('draws a table’s cells', () => {
    render(
      <PresentationView
        presentation={deck([
          {
            number: 1,
            background: { kind: 'color', color: '#ffffff' },
            elements: [
              {
                kind: 'table',
                frame: FRAME,
                rows: [[{ paragraphs: [{ runs: [run('Name')], level: 0, align: 'left', emptySizePt: 18 }] }]],
              },
            ],
          },
        ])}
      />,
    )

    expect(screen.getByRole('cell', { name: 'Name' })).not.toBeNull()
  })

  it('says when only the first slides of a long deck are shown', () => {
    render(
      <PresentationView
        presentation={deck([TITLE_SLIDE], { totalSlides: 250, isTruncated: true })}
      />,
    )

    expect(screen.getByRole('status').textContent).toBe(
      'This presentation is long, so only the first 200 of its 250 slides are shown.',
    )
  })

  it('says so when there are no slides', () => {
    render(<PresentationView presentation={deck([])} />)

    expect(screen.getByRole('status').textContent).toBe('This presentation has no slides to show.')
  })
})
