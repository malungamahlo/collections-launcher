/**
 * The resource-kind registry: the one place the app is taught what a kind of
 * file *is*. A `FileResource` only stores an open-ended `mimeType`; everything
 * the UI needs to know about that kind of file — what to call it, which icon
 * to show, what the file picker should offer, and how to open it — is looked
 * up here. Supporting a new file format means adding one entry to
 * `RESOURCE_KINDS`; no call site (search, uniqueness, storage, export) branches
 * on a specific format, so none of them changes.
 */

/** How a file resource is opened. */
export type ViewerStrategy =
  /** Rendered by the browser's built-in PDF viewer. */
  | 'native-pdf'
  /** Rendered as HTML in the app. */
  | 'render-markdown'
  /** Handed to the OS's installed application. The default for everything else. */
  | 'open-externally'

/**
 * Identifies an icon without importing one. The model layer stays free of
 * React and of any icon library; the presentation layer maps each key to a
 * component.
 */
export type ResourceIconKey =
  | 'file'
  | 'file-text'
  | 'file-code'
  | 'file-type'
  | 'file-spreadsheet'
  | 'presentation'

/** One concrete file format within a kind: a MIME type and its extensions. */
export interface ResourceFormat {
  /** The canonical MIME type, e.g. `application/pdf`. */
  readonly mimeType: string
  /** Lower-case extensions including the dot, e.g. `['.md', '.markdown']`. */
  readonly extensions: readonly string[]
}

/** Everything the app knows about one kind of file resource. */
export interface ResourceKind {
  /** A stable key for this kind. */
  readonly id: string
  /** A human-readable name, e.g. "PDF document". */
  readonly label: string
  readonly iconKey: ResourceIconKey
  readonly viewer: ViewerStrategy
  /** The formats belonging to this kind; the file picker offers exactly these. */
  readonly formats: readonly ResourceFormat[]
}

/** The MIME type used when nothing better is known. */
export const UNKNOWN_MIME_TYPE = 'application/octet-stream'

/**
 * What any file the registry doesn't list resolves to: a generic file that is
 * opened by the OS's installed application. Also what a future format gets
 * until it is deliberately given its own entry.
 */
export const DEFAULT_RESOURCE_KIND: ResourceKind = {
  id: 'file',
  label: 'File',
  iconKey: 'file',
  viewer: 'open-externally',
  formats: [],
}

/**
 * The seeded kinds. Word, Excel, and PowerPoint each list both the current
 * OOXML type and the legacy binary type; all of them are `open-externally`,
 * which is the strategy anything without a native viewer gets.
 */
export const RESOURCE_KINDS: readonly ResourceKind[] = [
  {
    id: 'pdf',
    label: 'PDF document',
    iconKey: 'file-text',
    viewer: 'native-pdf',
    formats: [{ mimeType: 'application/pdf', extensions: ['.pdf'] }],
  },
  {
    id: 'markdown',
    label: 'Markdown document',
    iconKey: 'file-code',
    viewer: 'render-markdown',
    formats: [
      { mimeType: 'text/markdown', extensions: ['.md', '.markdown'] },
    ],
  },
  {
    id: 'word',
    label: 'Word document',
    iconKey: 'file-type',
    viewer: 'open-externally',
    formats: [
      {
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extensions: ['.docx'],
      },
      { mimeType: 'application/msword', extensions: ['.doc'] },
    ],
  },
  {
    id: 'excel',
    label: 'Excel workbook',
    iconKey: 'file-spreadsheet',
    viewer: 'open-externally',
    formats: [
      {
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extensions: ['.xlsx'],
      },
      { mimeType: 'application/vnd.ms-excel', extensions: ['.xls'] },
    ],
  },
  {
    id: 'powerpoint',
    label: 'PowerPoint presentation',
    iconKey: 'presentation',
    viewer: 'open-externally',
    formats: [
      {
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        extensions: ['.pptx'],
      },
      { mimeType: 'application/vnd.ms-powerpoint', extensions: ['.ppt'] },
    ],
  },
]

/**
 * Reduces a MIME type to a comparable form: trimmed, lower-cased, without
 * parameters (`text/markdown; charset=utf-8` -> `text/markdown`).
 */
export function normalizeMimeType(mimeType: string): string {
  return (mimeType.split(';')[0] ?? '').trim().toLowerCase()
}

/**
 * Finds the kind a MIME type belongs to. Anything the registry doesn't list
 * (including an empty string) resolves to `DEFAULT_RESOURCE_KIND`.
 */
export function getResourceKind(mimeType: string): ResourceKind {
  const normalizedMimeType = normalizeMimeType(mimeType)

  return (
    RESOURCE_KINDS.find(kind =>
      kind.formats.some(format => format.mimeType === normalizedMimeType),
    ) ?? DEFAULT_RESOURCE_KIND
  )
}

/** How a file with this MIME type is opened. Unlisted types are `open-externally`. */
export function getViewerStrategy(mimeType: string): ViewerStrategy {
  return getResourceKind(mimeType).viewer
}

/**
 * Works out the MIME type to store for a picked file.
 *
 * A registered extension wins: browsers report `''` (or something generic like
 * `text/plain`) for a `.md` file depending on the operating system, so trusting
 * the declared type alone would make the same file resolve differently on
 * different machines. Otherwise the declared type is used, and a file that
 * declares nothing falls back to `application/octet-stream`.
 */
export function inferMimeType(fileName: string, declaredType: string): string {
  const extension = getExtension(fileName)

  if (extension) {
    for (const kind of RESOURCE_KINDS) {
      for (const format of kind.formats) {
        if (format.extensions.includes(extension)) {
          return format.mimeType
        }
      }
    }
  }

  return normalizeMimeType(declaredType) || UNKNOWN_MIME_TYPE
}

/** The lower-cased extension of a file name including the dot, or `''` if it has none. */
function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')

  return dotIndex > 0 ? fileName.slice(dotIndex).toLowerCase() : ''
}

/**
 * One entry of the `types` option of `showOpenFilePicker()`: a label and a map
 * from MIME type to the extensions that go with it. Declared here rather than
 * taken from the DOM lib (which doesn't ship these types) so the model layer
 * depends on no browser global; the real picker API accepts this shape as-is.
 */
export interface FilePickerType {
  readonly description: string
  readonly accept: Record<string, string[]>
}

/**
 * The `types` option for `showOpenFilePicker()`: a **single** entry covering
 * every registered format, so the picker restricts the user to files the app
 * can describe without asking them to choose a file type.
 *
 * Each entry in `types` becomes its own filter in the native dialog, and the
 * dialog opens on the first one. An entry per kind (PDF, Markdown, Word, …)
 * therefore meant only PDFs were listed until the user found and changed the
 * filter — and, since the "all files" option is excluded, could not see the
 * rest at all. One combined entry shows every supported file at once.
 *
 * Built from `RESOURCE_KINDS`, so a newly registered format appears in the
 * picker with no change here.
 */
export function getFilePickerTypes(): FilePickerType[] {
  return [
    {
      description: 'Supported files',
      accept: Object.fromEntries(
        RESOURCE_KINDS.flatMap(kind => kind.formats).map(format => [
          format.mimeType,
          [...format.extensions],
        ]),
      ),
    },
  ]
}
