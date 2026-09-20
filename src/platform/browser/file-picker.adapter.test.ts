import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BrowserFilePickerAdapter,
  FilePickerError,
  type FilePickerAcceptType,
} from './file-picker.adapter'

const types: FilePickerAcceptType[] = [
  { description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } },
]

function domError(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}

function createHandle(file: File | Error) {
  return {
    kind: 'file',
    name: file instanceof File ? file.name : 'broken.pdf',
    getFile: vi.fn(() =>
      file instanceof Error ? Promise.reject(file) : Promise.resolve(file),
    ),
  } as unknown as FileSystemFileHandle
}

/** Installs a fake `showOpenFilePicker` on the global object for one test. */
function stubPicker(implementation: (...args: unknown[]) => unknown) {
  const showOpenFilePicker = vi.fn(implementation)
  vi.stubGlobal('showOpenFilePicker', showOpenFilePicker)
  return showOpenFilePicker
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BrowserFilePickerAdapter', () => {
  it('returns the handle and the file read through it', async () => {
    const file = new File(['%PDF'], 'handbook.pdf', { type: 'application/pdf' })
    const handle = createHandle(file)
    stubPicker(() => Promise.resolve([handle]))

    const picked = await new BrowserFilePickerAdapter().pickFile(types)

    expect(picked?.handle).toBe(handle)
    expect(picked?.file).toBe(file)
  })

  it('asks for a single file, offering only the given types and no "all files" option', async () => {
    const picker = stubPicker(() =>
      Promise.resolve([createHandle(new File(['x'], 'a.pdf'))]),
    )

    await new BrowserFilePickerAdapter().pickFile(types)

    expect(picker).toHaveBeenCalledWith({
      multiple: false,
      excludeAcceptAllOption: true,
      types,
    })
  })

  it('calls the picker with the global object as `this`, as the browser requires', async () => {
    const picker = stubPicker(() =>
      Promise.resolve([createHandle(new File(['x'], 'a.pdf'))]),
    )

    await new BrowserFilePickerAdapter().pickFile(types)

    expect(picker.mock.contexts[0]).toBe(globalThis)
  })

  it('resolves to undefined, not an error, when the user dismisses the picker', async () => {
    stubPicker(() => Promise.reject(domError('AbortError')))

    await expect(
      new BrowserFilePickerAdapter().pickFile(types),
    ).resolves.toBeUndefined()
  })

  it('resolves to undefined if the picker returns no file', async () => {
    stubPicker(() => Promise.resolve([]))

    await expect(
      new BrowserFilePickerAdapter().pickFile(types),
    ).resolves.toBeUndefined()
  })

  it('reports UNSUPPORTED when the browser has no File System Access API', async () => {
    vi.stubGlobal('showOpenFilePicker', undefined)

    await expect(
      new BrowserFilePickerAdapter().pickFile(types),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED' })
  })

  it('reports UNAVAILABLE, keeping the cause, when the picker fails for another reason', async () => {
    const cause = domError('SecurityError')
    stubPicker(() => Promise.reject(cause))

    const error = await new BrowserFilePickerAdapter()
      .pickFile(types)
      .catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(FilePickerError)
    expect(error).toMatchObject({ code: 'UNAVAILABLE', cause })
  })

  it('reports UNREADABLE when the chosen file cannot be read', async () => {
    stubPicker(() =>
      Promise.resolve([createHandle(domError('NotReadableError'))]),
    )

    await expect(
      new BrowserFilePickerAdapter().pickFile(types),
    ).rejects.toMatchObject({ code: 'UNREADABLE' })
  })
})
