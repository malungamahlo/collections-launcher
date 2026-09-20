// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AddResourceType } from '../hooks/use-add-resource'
import { AddResourceDialog } from './add-resource-dialog'

afterEach(() => {
  cleanup()
})

// Stand-ins for the real forms. Like them, each takes focus when it appears.
const websiteForm = (
  <form>
    <label>
      Website field
      <input autoFocus />
    </label>
  </form>
)
const fileForm = (
  <form>
    <button type="button" autoFocus>
      Choose file…
    </button>
  </form>
)

function renderDialog(
  overrides: Partial<Parameters<typeof AddResourceDialog>[0]> = {},
) {
  const props = {
    type: 'website' as AddResourceType,
    onTypeChange: vi.fn(),
    isBusy: false,
    websiteForm,
    fileForm,
    onClose: vi.fn(),
    ...overrides,
  }

  render(<AddResourceDialog {...props} />)

  return props
}

/** A dialog whose type is real state, so a switch actually swaps the form. */
function StatefulDialog({ initial = 'website' }: { initial?: AddResourceType }) {
  const [type, setType] = useState<AddResourceType>(initial)

  return (
    <AddResourceDialog
      type={type}
      onTypeChange={setType}
      isBusy={false}
      websiteForm={websiteForm}
      fileForm={fileForm}
      onClose={vi.fn()}
    />
  )
}

function getRadio(name: string): HTMLInputElement {
  return screen.getByRole('radio', { name }) as HTMLInputElement
}

describe('AddResourceDialog', () => {
  it('is titled as adding a resource, and mentions both kinds', () => {
    renderDialog()

    expect(screen.getByText('Add a resource')).not.toBeNull()
    expect(screen.getByText(/a website or a file/)).not.toBeNull()
  })

  it('offers a Website / File switch with Website selected by default', () => {
    renderDialog()

    expect(screen.getByRole('radiogroup', { name: 'Resource type' })).not.toBeNull()
    expect(getRadio('Website').checked).toBe(true)
    expect(getRadio('File').checked).toBe(false)
  })

  it('shows only the website form for the Website type', () => {
    renderDialog({ type: 'website' })

    expect(screen.getByLabelText('Website field')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Choose file…' })).toBeNull()
  })

  it('shows only the file form for the File type, with File selected', () => {
    renderDialog({ type: 'file' })

    expect(screen.getByRole('button', { name: 'Choose file…' })).not.toBeNull()
    expect(screen.queryByLabelText('Website field')).toBeNull()
    expect(getRadio('File').checked).toBe(true)
    expect(getRadio('Website').checked).toBe(false)
  })

  it('reports the type the user picks', async () => {
    const user = userEvent.setup()
    const { onTypeChange } = renderDialog()

    await user.click(getRadio('File'))

    expect(onTypeChange).toHaveBeenCalledWith('file')
  })

  it('locks the switch while busy', () => {
    renderDialog({ isBusy: true })

    expect(getRadio('Website').disabled).toBe(true)
    expect(getRadio('File').disabled).toBe(true)
  })

  it('swaps the form when the type changes', async () => {
    const user = userEvent.setup()
    render(<StatefulDialog />)

    await user.click(getRadio('File'))

    expect(screen.getByRole('button', { name: 'Choose file…' })).not.toBeNull()
    expect(screen.queryByLabelText('Website field')).toBeNull()

    await user.click(getRadio('Website'))

    expect(screen.getByLabelText('Website field')).not.toBeNull()
  })

  describe('focus', () => {
    it('focuses the first field of the form when it first opens', () => {
      render(<StatefulDialog />)

      expect(document.activeElement).toBe(screen.getByLabelText('Website field'))
    })

    it('keeps focus on the switch after choosing a type, instead of letting the new form take it', async () => {
      const user = userEvent.setup()
      render(<StatefulDialog />)

      await user.click(getRadio('File'))

      expect(document.activeElement).toBe(getRadio('File'))
    })

    it('keeps focus on the switch when moving back too', async () => {
      const user = userEvent.setup()
      render(<StatefulDialog />)
      await user.click(getRadio('File'))

      await user.click(getRadio('Website'))

      expect(document.activeElement).toBe(getRadio('Website'))
    })
  })

  it('closes when the browser cancels the dialog (Escape)', () => {
    const { onClose } = renderDialog()

    // The shared Dialog turns the native `cancel` event, which is what Escape
    // raises, into onClose. Dispatch it directly rather than rely on the test
    // DOM to translate a key press into one.
    screen
      .getByRole('dialog', { hidden: true })
      .dispatchEvent(new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
