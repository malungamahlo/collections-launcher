// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileActionToast } from './file-action-toast'

afterEach(cleanup)

const noop = () => undefined

describe('FileActionToast', () => {
  it('shows an informational notice as a polite status', () => {
    render(
      <FileActionToast
        notice={{ tone: 'info', message: 'Opening "Contract"…' }}
        onAction={noop}
        onDismiss={noop}
      />,
    )

    expect(screen.getByRole('status').textContent).toContain('Opening "Contract"…')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('announces an error as an alert', () => {
    render(
      <FileActionToast
        notice={{ tone: 'error', message: 'Could not open it.' }}
        onAction={noop}
        onDismiss={noop}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain('Could not open it.')
  })

  it('has no action button unless the notice offers one', () => {
    render(
      <FileActionToast
        notice={{ tone: 'info', message: 'Done.' }}
        onAction={noop}
        onDismiss={noop}
      />,
    )

    // Only the dismiss button is there.
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Dismiss' })).not.toBeNull()
  })

  it('shows the notice’s action and calls onAction when it is pressed', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(
      <FileActionToast
        notice={{ tone: 'info', message: 'It is ready.', actionLabel: 'Open' }}
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('calls onDismiss from the dismiss button', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(
      <FileActionToast
        notice={{ tone: 'error', message: 'Failed.', actionLabel: 'Try again' }}
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onAction).not.toHaveBeenCalled()
  })
})
