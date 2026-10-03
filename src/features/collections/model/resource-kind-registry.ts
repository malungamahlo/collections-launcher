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
  /** A Word document drawn as pages, in the app. */
  | 'render-word'
  /** A workbook shown as its sheets' tables, in the app. */
  | 'render-spreadsheet'
  /** A presentation drawn slide by slide, in the app. */
  | 'render-presentation'
  /**
   * Shown only by the OS's installed application, through a temporary copy the
   * user never sees (`ExternalOpenAdapter`) — the default for anything the
   * browser cannot draw, including the legacy binary `.doc` and `.ppt`.
   */
  | 'open-externally'

/** The desktop application a kind of file can also be opened in. */
export type ResourceAppName = 'Word' | 'Excel' | 'PowerPoint'

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
  /**
   * How this one format opens, when that differs from its kind — a `.docx` can
   * be drawn in the browser, but the legacy binary `.doc` cannot.
   */
  readonly viewer?: ViewerStrategy
}

/** Everything the app knows about one kind of file resource. */
export interface ResourceKind {
  /** A stable key for this kind. */
  readonly id: string
  /** A human-readable name, e.g. "PDF document". */
  readonly label: string
  readonly iconKey: ResourceIconKey
  readonly viewer: ViewerStrategy
  /** The desktop application this kind can also be opened in, if any. */
  readonly appName?: ResourceAppName
  /** The formats belonging to this kind; the file picker offers exactly these. */
  readonly formats: readonly ResourceFormat[]
}

/** The MIME type used when nothing better is known. */
export const UNKNOWN_MIME_TYPE = 'application/octet-stream'

/**
 * What any file the registry doesn't list resolves to: a generic file with no
 * in-app viewer (`open-externally`). Also what a future format gets until it is
 * deliberately given its own entry.
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
 * OOXML type and the legacy binary type. The browser draws the OOXML ones (and
 * a legacy `.xls`, which the spreadsheet reader also understands); a legacy
 * `.doc` or `.ppt` opens only in its application. Every Office kind can also
 * be opened in its application on request.
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
    viewer: 'render-word',
    appName: 'Word',
    formats: [
      {
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extensions: ['.docx'],
      },
      {
        mimeType: 'application/msword',
        extensions: ['.doc'],
        viewer: 'open-externally',
      },
    ],
  },
  {
    id: 'excel',
    label: 'Excel workbook',
    iconKey: 'file-spreadsheet',
    viewer: 'render-spreadsheet',
    appName: 'Excel',
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
    viewer: 'render-presentation',
    appName: 'PowerPoint',
    formats: [
      {
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        extensions: ['.pptx'],
      },
      {
        mimeType: 'application/vnd.ms-powerpoint',
        extensions: ['.ppt'],
        viewer: 'open-externally',
      },
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

/** The registered format a MIME type names, if any. */
function findFormat(mimeType: string): ResourceFormat | undefined {
  const normalizedMimeType = normalizeMimeType(mimeType)

  return RESOURCE_KINDS.flatMap(kind => kind.formats).find(
    format => format.mimeType === normalizedMimeType,
  )
}

/**
 * How a file with this MIME type is opened when its row is clicked: its
 * format's own strategy if it has one, otherwise its kind's. Unlisted types are
 * `open-externally`.
 */
export function getViewerStrategy(mimeType: string): ViewerStrategy {
  return findFormat(mimeType)?.viewer ?? getResourceKind(mimeType).viewer
}

/** The ways a file of some type can be opened, for offering them as choices. */
export interface ResourceOpenOptions {
  /** Whether the browser can show it (in its own tab, like a website). */
  readonly inBrowser: boolean
  /** The desktop application it can also be opened in, if any. */
  readonly appName?: ResourceAppName
}

/**
 * Which ways of opening a file to offer, so no component has to branch on a
 * format. Everything the registry knows how to draw — PDF, Markdown, and the
 * Office formats the browser can show — opens in the browser; every Office
 * kind can also open in its application.
 */
export function getOpenOptions(mimeType: string): ResourceOpenOptions {
  const { appName } = getResourceKind(mimeType)

  return {
    inBrowser: getViewerStrategy(mimeType) !== 'open-externally',
    ...(appName ? { appName } : {}),
  }
}

/**
 * The extension (with its dot) a file of this MIME type is given when it is
 * saved or handed to an application: the first one the registry lists for that
 * format. A resource stores only a name, never the original file name, so this
 * is where the extension an operating system needs to pick the right
 * application comes from. Returns `''` for a type the registry doesn't list.
 */
export function getFileExtension(mimeType: string): string {
  const normalizedMimeType = normalizeMimeType(mimeType)

  for (const kind of RESOURCE_KINDS) {
    for (const format of kind.formats) {
      if (format.mimeType === normalizedMimeType) {
        return format.extensions[0] ?? ''
      }
    }
  }

  return ''
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
