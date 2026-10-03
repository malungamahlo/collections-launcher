// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Menu } from './menu'

afterEach(() => {
  cleanup()
})

function renderMenu() {
  const first = vi.fn()
  const second = vi.fn()
  const third = vi.fn()
  render(
    <div>
      <Menu
        label="More options"
        items={[
          { label: 'First', onSelect: first },
          { label: 'Second', onSelect: second },
          { label: 'Third', onSelect: third },
        ]}
      >
        …
      </Menu>
      <button type="button">Elsewhere</button>
    </div>,
  )

  return { first, second, third, trigger: screen.getByRole('button', { name: 'More options' }) }
}

describe('Menu', () => {
  it('is closed until its button is pressed, and says so', () => {
    const { trigger } = renderMenu()

    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens with its items and puts focus on the first', async () => {
    const user = userEvent.setup()
    const { trigger } = renderMenu()

    await user.click(trigger)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'First',
      'Second',
      'Third',
    ])
    expect(document.activeElement?.textContent).toBe('First')
  })

  it('moves between items with the arrow keys, Home and End, wrapping around', async () => {
    const user = userEvent.setup()
    const { trigger } = renderMenu()
    await user.click(trigger)

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement?.textContent).toBe('Second')
    await user.keyboard('{End}')
    expect(document.activeElement?.textContent).toBe('Third')
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement?.textContent).toBe('First')
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement?.textContent).toBe('Third')
    await user.keyboard('{Home}')
    expect(document.activeElement?.textContent).toBe('First')
  })

  it('runs the chosen item, closes, and returns focus to its button', async () => {
    const user = userEvent.setup()
    const { second, first, trigger } = renderMenu()
    await user.click(trigger)

    await user.click(screen.getByRole('menuitem', { name: 'Second' }))

    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('runs an item chosen with Enter', async () => {
    const user = userEvent.setup()
    const { second, trigger } = renderMenu()
    await user.click(trigger)

    await user.keyboard('{ArrowDown}{Enter}')

    expect(second).toHaveBeenCalledOnce()
  })

  it('closes on Escape without running anything, focus back on its button', async () => {
    const user = userEvent.setup()
    const { first, trigger } = renderMenu()
    await user.click(trigger)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).toBeNull()
    expect(first).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes when something else on the page is clicked', async () => {
    const user = userEvent.setup()
    const { trigger } = renderMenu()
    await user.click(trigger)

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes when its button is pressed again', async () => {
    const user = userEvent.setup()
    const { trigger } = renderMenu()
    await user.click(trigger)

    await user.click(trigger)

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens from the keyboard with the down arrow', async () => {
    const user = userEvent.setup()
    const { trigger } = renderMenu()
    trigger.focus()

    await user.keyboard('{ArrowDown}')

    expect(screen.getByRole('menu')).not.toBeNull()
  })
})
