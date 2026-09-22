// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { StrictMode, useRef, useState } from 'react'
import { Dialog } from './dialog'

afterEach(cleanup)

/** Provides a real trigger so focus restoration can be tested end to end. */
function DialogHarness({ removeTriggerOnClose = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showTrigger, setShowTrigger] = useState(true)
  const fallbackFocusRef = useRef<HTMLButtonElement>(null)

  function closeDialog(): void {
    setIsOpen(false)
    if (removeTriggerOnClose) {
      setShowTrigger(false)
    }
  }

  return (
    <>
      <button ref={fallbackFocusRef}>Dashboard fallback</button>
      {showTrigger && (
        <button type="button" onClick={() => setIsOpen(true)}>
          Open dialog
        </button>
      )}
      {isOpen && (
        <Dialog
          title="Test dialog"
          fallbackFocusRef={fallbackFocusRef}
          onClose={closeDialog}
        >
          <button type="button" autoFocus onClick={closeDialog}>
            Close dialog
          </button>
        </Dialog>
      )}
    </>
  )
}

describe('Dialog focus behavior', () => {
  it('moves focus into the dialog and restores it to the trigger', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <DialogHarness />
      </StrictMode>,
    )
    const trigger = screen.getByRole('button', { name: 'Open dialog' })

    await user.click(trigger)
    const closeButton = await screen.findByRole('button', {
      name: 'Close dialog',
    })
    await waitFor(() => expect(document.activeElement).toBe(closeButton))

    await user.click(closeButton)
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('closes on a native cancel event and restores trigger focus', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })

    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    fireEvent(dialog, new Event('cancel', { cancelable: true }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('uses dashboard fallback focus when the original trigger is removed', async () => {
    const user = userEvent.setup()
    render(<DialogHarness removeTriggerOnClose />)

    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    await user.click(
      await screen.findByRole('button', { name: 'Close dialog' }),
    )

    const fallback = screen.getByRole('button', {
      name: 'Dashboard fallback',
    })
    await waitFor(() => expect(document.activeElement).toBe(fallback))
  })
})
