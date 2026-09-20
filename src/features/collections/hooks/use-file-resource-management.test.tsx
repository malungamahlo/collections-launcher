// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileContentAdapter } from '@app/platform/browser/file-content.adapter'
import {
  FilePickerError,
  type FilePickerAdapter,
  type PickedFile,
} from '@app/platform/browser/file-picker.adapter'
import { MAX_FILE_RESOURCE_SIZE_BYTES } from '../model/file-resource.validation'
import type { CollectionsState } from '../model/collection.types'
import {
  createTestCollection,
  createTestFileResource,
  createTestState,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import {
  suggestResourceName,
  useFileResourceManagement,
} from './use-file-resource-management'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function createPickedFile(
  name = 'Employee handbook.pdf',
  type = 'application/pdf',
  content = '%PDF-1.7',
): PickedFile {
  return {
    handle: { kind: 'file', name } as unknown as FileSystemFileHandle,
    file: new File([content], name, { type }),
  }
}

function createFilePicker(
  ...results: Array<PickedFile | undefined | Error>
): FilePickerAdapter & { readonly pickFile: ReturnType<typeof vi.fn> } {
  const pickFile = vi.fn()

  for (const result of results) {
    if (result instanceof Error) {
      pickFile.mockRejectedValueOnce(result)
    } else {
      pickFile.mockResolvedValueOnce(result)
    }
  }

  return { pickFile } as FilePickerAdapter & {
    readonly pickFile: ReturnType<typeof vi.fn>
  }
}

function createFileContent() {
  const calls: string[] = []

  const fileContent = {
    saveHandle: vi.fn((id: string, handle: FileSystemFileHandle) => {
      void id
      void handle
      calls.push('saveHandle')
      return Promise.resolve()
    }),
    saveBlob: vi.fn(() => Promise.resolve()),
    load: vi.fn(),
    remove: vi.fn((id: string) => {
      void id
      calls.push('remove')
      return Promise.resolve()
    }),
  }

  return { fileContent: fileContent as unknown as FileContentAdapter, spies: fileContent, calls }
}

function createSave(calls?: string[]) {
  return vi.fn((state: CollectionsState) => {
    void state
    calls?.push('save')
    return Promise.resolve()
  })
}

/** Renders the hook, opens the form on a collection, and picks a file. */
async function openWithPickedFile(
  options: {
    picker?: ReturnType<typeof createFilePicker>
    state?: CollectionsState
    save?: ReturnType<typeof createSave>
    content?: ReturnType<typeof createFileContent>
  } = {},
) {
  const collection = createTestCollection()
  const state = options.state ?? createTestState({ collections: [collection] })
  const picker = options.picker ?? createFilePicker(createPickedFile())
  const content = options.content ?? createFileContent()
  const save = options.save ?? createSave(content.calls)
  const rendered = renderHook(() =>
    useFileResourceManagement({
      state,
      save,
      filePicker: picker,
      fileContent: content.fileContent,
    }),
  )

  act(() => rendered.result.current.openCreate(collection))
  await act(async () => rendered.result.current.chooseFile())

  return { ...rendered, collection, picker, content, save }
}

describe('suggestResourceName', () => {
  it.each([
    ['Employee handbook.pdf', 'Employee handbook'],
    ['notes.md', 'notes'],
    ['archive.tar.gz', 'archive.tar'],
    ['Budget 2026.XLSX', 'Budget 2026'],
    ['no-extension', 'no-extension'],
    ['.pdf', '.pdf'],
    ['  spaced name .docx', 'spaced name'],
  ])('suggests %s -> %s', (fileName, expected) => {
    expect(suggestResourceName(fileName)).toBe(expected)
  })

  it('cuts a very long name to the maximum resource name length', () => {
    expect(suggestResourceName(`${'a'.repeat(150)}.pdf`)).toHaveLength(100)
  })
})

describe('useFileResourceManagement', () => {
  describe('opening the form', () => {
    it('opens a clean form preselected to the collection', () => {
      const collection = createTestCollection()
      const { result } = renderHook(() =>
        useFileResourceManagement({
          state: createTestState({ collections: [collection] }),
          save: createSave(),
          filePicker: createFilePicker(),
          fileContent: createFileContent().fileContent,
        }),
      )

      act(() => result.current.openCreate(collection))

      expect(result.current.isOpen).toBe(true)
      expect(result.current.formValues).toEqual({
        name: '',
        collectionId: collection.id,
      })
      expect(result.current.pickedFile).toBeUndefined()
    })

    it('forgets a previous choice when reopened', async () => {
      const { result, collection } = await openWithPickedFile()
      expect(result.current.pickedFile).toBeDefined()

      act(() => result.current.close())
      act(() => result.current.openCreate(collection))

      expect(result.current.pickedFile).toBeUndefined()
      expect(result.current.formValues.name).toBe('')
    })
  })

  describe('choosing a file', () => {
    it('remembers the file, works out its MIME type, and suggests a name', async () => {
      const { result } = await openWithPickedFile()

      expect(result.current.pickedFile).toMatchObject({
        fileName: 'Employee handbook.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 8,
      })
      expect(result.current.formValues.name).toBe('Employee handbook')
    })

    it('summarizes the chosen file for display, with its kind from the registry', async () => {
      const { result } = await openWithPickedFile()

      expect(result.current.chosenFile).toEqual({
        fileName: 'Employee handbook.pdf',
        kindLabel: 'PDF document',
        sizeBytes: 8,
      })
    })

    it('has no summary until a file is chosen', async () => {
      const { result } = await openWithPickedFile({
        picker: createFilePicker(undefined),
      })

      expect(result.current.chosenFile).toBeUndefined()
    })

    it('offers the picker exactly the formats the registry lists', async () => {
      const { picker } = await openWithPickedFile()

      const [types] = picker.pickFile.mock.calls[0] as [
        Array<{ description: string }>,
      ]
      expect(types.map(type => type.description)).toContain('PDF document')
      expect(types.map(type => type.description)).toContain('Word document')
    })

    it('resolves a Markdown file with no declared type by its extension', async () => {
      const { result } = await openWithPickedFile({
        picker: createFilePicker(createPickedFile('notes.md', '')),
      })

      expect(result.current.pickedFile?.mimeType).toBe('text/markdown')
    })

    it('adds an Office file with no code beyond the registry entry', async () => {
      const docx =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const { result } = await openWithPickedFile({
        picker: createFilePicker(createPickedFile('Plan.docx', '')),
      })

      expect(result.current.pickedFile?.mimeType).toBe(docx)
    })

    it('changes nothing when the picker is dismissed', async () => {
      const { result, collection } = await openWithPickedFile({
        picker: createFilePicker(undefined),
      })

      expect(result.current.pickedFile).toBeUndefined()
      expect(result.current.fileError).toBeUndefined()
      expect(result.current.formValues).toEqual({ name: '', collectionId: collection.id })
    })

    it('keeps an earlier choice when a later pick is dismissed', async () => {
      const { result } = await openWithPickedFile({
        picker: createFilePicker(createPickedFile(), undefined),
      })

      await act(async () => result.current.chooseFile())

      expect(result.current.pickedFile?.fileName).toBe('Employee handbook.pdf')
    })

    it('refuses an oversized file with a clear message and keeps no choice', async () => {
      const oversized: PickedFile = {
        handle: { kind: 'file', name: 'huge.pdf' } as unknown as FileSystemFileHandle,
        file: { name: 'huge.pdf', type: 'application/pdf', size: MAX_FILE_RESOURCE_SIZE_BYTES + 1 } as File,
      }
      const { result } = await openWithPickedFile({
        picker: createFilePicker(oversized),
      })

      expect(result.current.pickedFile).toBeUndefined()
      expect(result.current.fileError).toBe('Files must be 100 MB or smaller.')
    })

    it('keeps an earlier good choice when a later file is oversized', async () => {
      const oversized: PickedFile = {
        handle: { kind: 'file', name: 'huge.pdf' } as unknown as FileSystemFileHandle,
        file: { name: 'huge.pdf', type: 'application/pdf', size: MAX_FILE_RESOURCE_SIZE_BYTES + 1 } as File,
      }
      const { result } = await openWithPickedFile({
        picker: createFilePicker(createPickedFile(), oversized),
      })

      await act(async () => result.current.chooseFile())

      expect(result.current.pickedFile?.fileName).toBe('Employee handbook.pdf')
      expect(result.current.fileError).toBe('Files must be 100 MB or smaller.')
    })

    it('shows the picker error message when the picker reports a known failure', async () => {
      const { result } = await openWithPickedFile({
        picker: createFilePicker(new FilePickerError('UNREADABLE', 'That file could not be read.')),
      })

      expect(result.current.fileError).toBe('That file could not be read.')
      expect(result.current.pickedFile).toBeUndefined()
    })

    it('shows a generic message, and logs, for an unexpected failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const { result } = await openWithPickedFile({
        picker: createFilePicker(new Error('boom')),
      })

      expect(result.current.fileError).toBe('The file could not be added. Try again.')
      expect(consoleError).toHaveBeenCalled()
    })

    it('does not replace a name the user has typed', async () => {
      const { result } = await openWithPickedFile({
        picker: createFilePicker(createPickedFile(), createPickedFile('Other.pdf')),
      })

      act(() =>
        result.current.updateFormValues({
          ...result.current.formValues,
          name: 'My own name',
        }),
      )
      await act(async () => result.current.chooseFile())

      expect(result.current.formValues.name).toBe('My own name')
    })

    it('replaces an untouched suggestion when a different file is chosen', async () => {
      const { result } = await openWithPickedFile({
        picker: createFilePicker(createPickedFile(), createPickedFile('Other.pdf')),
      })

      await act(async () => result.current.chooseFile())

      expect(result.current.formValues.name).toBe('Other')
    })
  })

  describe('adding the file', () => {
    it('stores the file reference, then saves the new resource, then closes', async () => {
      const content = createFileContent()
      const { result, collection, save } = await openWithPickedFile({ content })

      await act(async () => result.current.submit())

      const savedResources = save.mock.calls[0]?.[0].collections[0]?.resources
      const saved = savedResources?.[0]
      expect(saved).toMatchObject({
        type: 'file',
        name: 'Employee handbook',
        mimeType: 'application/pdf',
        sizeBytes: 8,
      })
      expect(content.spies.saveHandle).toHaveBeenCalledWith(
        saved?.id,
        result.current.pickedFile?.handle,
      )
      expect(content.calls).toEqual(['saveHandle', 'save'])
      expect(result.current.isOpen).toBe(false)
      expect(save.mock.calls[0]?.[0].collections[0]?.id).toBe(collection.id)
    })

    it('uses the name the user edited', async () => {
      const { result, save } = await openWithPickedFile()

      act(() =>
        result.current.updateFormValues({
          ...result.current.formValues,
          name: '  Handbook (2026)  ',
        }),
      )
      await act(async () => result.current.submit())

      expect(save.mock.calls[0]?.[0].collections[0]?.resources[0]?.name).toBe('Handbook (2026)')
    })

    it('adds to the collection chosen in the form, not only the one that opened it', async () => {
      const first = createTestCollection({ id: 'first', name: 'First' })
      const second = createTestCollection({ id: 'second', name: 'Second' })
      const { result, save } = await openWithPickedFile({
        state: createTestState({ collections: [first, second] }),
      })

      act(() =>
        result.current.updateFormValues({
          ...result.current.formValues,
          collectionId: 'second',
        }),
      )
      await act(async () => result.current.submit())

      const savedState = save.mock.calls[0]?.[0]
      expect(savedState?.collections[0]?.resources).toEqual([])
      expect(savedState?.collections[1]?.resources).toHaveLength(1)
    })

    it('does nothing and asks for a file when none has been chosen', async () => {
      const content = createFileContent()
      const { result, save } = await openWithPickedFile({
        picker: createFilePicker(undefined),
        content,
      })

      await act(async () => result.current.submit())

      expect(result.current.fileError).toBe('Choose a file to add.')
      expect(content.spies.saveHandle).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
      expect(result.current.isOpen).toBe(true)
    })

    it('does nothing when the name is invalid', async () => {
      const content = createFileContent()
      const { result, save } = await openWithPickedFile({ content })

      act(() =>
        result.current.updateFormValues({
          ...result.current.formValues,
          name: '   ',
        }),
      )
      await act(async () => result.current.submit())

      expect(result.current.nameError).toBe('Enter a resource name.')
      expect(content.spies.saveHandle).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
    })

    it('shows a duplicate-name error, storing and saving nothing', async () => {
      const collection = createTestCollection({
        resources: [createTestWebsiteResource({ name: 'Employee handbook' })],
      })
      const content = createFileContent()
      const { result, save } = await openWithPickedFile({
        state: createTestState({ collections: [collection] }),
        content,
      })

      await act(async () => result.current.submit())

      expect(result.current.nameError).toBe(
        'A resource with this name already exists in that collection.',
      )
      expect(content.spies.saveHandle).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
      expect(result.current.isOpen).toBe(true)
    })

    it('rejects a name already used by another file in the collection', async () => {
      const collection = createTestCollection({
        resources: [createTestFileResource({ name: 'employee handbook' })],
      })
      const { result } = await openWithPickedFile({
        state: createTestState({ collections: [collection] }),
      })

      await act(async () => result.current.submit())

      expect(result.current.nameError).toBeDefined()
    })

    it('removes the stored file reference and keeps the form open when saving fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const content = createFileContent()
      const save = createSave().mockRejectedValue(new Error('storage failure'))
      const { result } = await openWithPickedFile({ content, save })

      await act(async () => result.current.submit())

      const storedId = content.spies.saveHandle.mock.calls[0]?.[0]
      expect(content.spies.remove).toHaveBeenCalledWith(storedId)
      expect(result.current.formError).toBe('The file could not be added. Try again.')
      expect(result.current.isOpen).toBe(true)
      expect(consoleError).toHaveBeenCalled()
    })

    it('still reports the save failure if removing the reference also fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const content = createFileContent()
      content.spies.remove.mockRejectedValueOnce(new Error('cleanup failed'))
      const save = createSave().mockRejectedValue(new Error('storage failure'))
      const { result } = await openWithPickedFile({ content, save })

      await act(async () => result.current.submit())

      expect(result.current.formError).toBe('The file could not be added. Try again.')
      expect(consoleError).toHaveBeenCalledTimes(2)
    })

    it('saves nothing when the file reference cannot be stored', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const content = createFileContent()
      content.spies.saveHandle.mockRejectedValueOnce(new Error('quota'))
      const { result, save } = await openWithPickedFile({ content })

      await act(async () => result.current.submit())

      expect(save).not.toHaveBeenCalled()
      expect(content.spies.remove).not.toHaveBeenCalled()
      expect(result.current.formError).toBe('The file could not be added. Try again.')
    })

    it('stores nothing when the target collection no longer exists', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const content = createFileContent()
      const { result, save } = await openWithPickedFile({
        state: createTestState(),
        content,
      })

      await act(async () => result.current.submit())

      expect(content.spies.saveHandle).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
      expect(result.current.formError).toBe('The file could not be added. Try again.')
    })

    it('clears a stale name error once the name is corrected', async () => {
      const { result } = await openWithPickedFile()
      act(() =>
        result.current.updateFormValues({ ...result.current.formValues, name: '' }),
      )
      await act(async () => result.current.submit())
      expect(result.current.nameError).toBe('Enter a resource name.')

      act(() =>
        result.current.updateFormValues({ ...result.current.formValues, name: 'Fixed' }),
      )

      expect(result.current.nameError).toBeUndefined()
    })
  })
})
