import JSZip from 'jszip'

/**
 * Reading the parts of an Office Open XML package (`.pptx`, and the like): a
 * zip of XML files linked by "relationships". The file is untrusted, so every
 * part's size is checked before it is decompressed, and the whole package has
 * a budget — a small file that unpacks into gigabytes is refused rather than
 * read.
 */

/** Parses XML text into a DOM document. The browser's `DOMParser` in the app. */
export type ParseXml = (text: string) => Document

export const NS = {
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  rels: 'http://schemas.openxmlformats.org/package/2006/relationships',
} as const

/** The most one XML part may unpack to. Real slides are a few hundred KB at most. */
const MAX_XML_PART_BYTES = 8 * 1024 * 1024
/** The most one picture may unpack to. */
const MAX_IMAGE_BYTES = 30 * 1024 * 1024
/** The most the whole package may unpack to, across every part read. */
const MAX_TOTAL_BYTES = 300 * 1024 * 1024

/** A part's uncompressed size as the zip declares it, before anything is unpacked. */
function declaredSize(entry: JSZip.JSZipObject): number {
  const data = (entry as unknown as { _data?: { uncompressedSize?: unknown } })._data
  const size = data?.uncompressedSize

  return typeof size === 'number' && Number.isFinite(size) ? size : Infinity
}

/** Thrown when a package is too large, or not a package at all. */
export class OfficePackageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OfficePackageError'
  }
}

/** One package's parts, read on demand, with every read counted against the budget. */
export class OfficePackage {
  private spent = 0
  private readonly xmlCache = new Map<string, Document | undefined>()

  private constructor(
    private readonly zip: JSZip,
    private readonly parseXml: ParseXml,
  ) {}

  static async open(bytes: ArrayBuffer, parseXml: ParseXml): Promise<OfficePackage> {
    try {
      return new OfficePackage(await JSZip.loadAsync(bytes), parseXml)
    } catch {
      throw new OfficePackageError('Not an Office document.')
    }
  }

  has(path: string): boolean {
    return this.zip.file(path) !== null
  }

  private async readBytes(path: string, limit: number): Promise<Uint8Array | undefined> {
    const entry = this.zip.file(path)

    if (!entry) {
      return undefined
    }

    const size = declaredSize(entry)

    if (size > limit || this.spent + size > MAX_TOTAL_BYTES) {
      throw new OfficePackageError('The document is too large to show.')
    }

    const bytes = await entry.async('uint8array')
    // The declared size is only a claim; count what actually came out too.
    this.spent += bytes.byteLength

    if (bytes.byteLength > limit || this.spent > MAX_TOTAL_BYTES) {
      throw new OfficePackageError('The document is too large to show.')
    }

    return bytes
  }

  /** A part parsed as XML, or `undefined` when it is missing or not well-formed. */
  async xml(path: string): Promise<Document | undefined> {
    if (this.xmlCache.has(path)) {
      return this.xmlCache.get(path)
    }

    const bytes = await this.readBytes(path, MAX_XML_PART_BYTES)
    let document: Document | undefined

    if (bytes) {
      try {
        const parsed = this.parseXml(new TextDecoder().decode(bytes))
        // The browser's parser reports a malformed document as a <parsererror>
        // element rather than throwing; other parsers throw.
        document =
          parsed.getElementsByTagName('parsererror').length > 0 ? undefined : parsed
      } catch {
        document = undefined
      }
    }

    this.xmlCache.set(path, document)

    return document
  }

  /** A part's raw bytes, for a picture. */
  async image(path: string): Promise<Uint8Array | undefined> {
    return this.readBytes(path, MAX_IMAGE_BYTES)
  }

  /**
   * A part's relationships, by id, each resolved to the path of the part it
   * points at. Links to anything outside the package (`TargetMode="External"`)
   * are dropped: nothing is ever fetched.
   */
  async relationships(partPath: string): Promise<ReadonlyMap<string, Relationship>> {
    const slash = partPath.lastIndexOf('/')
    const folder = partPath.slice(0, slash + 1)
    const name = partPath.slice(slash + 1)
    const document = await this.xml(`${folder}_rels/${name}.rels`)
    const relationships = new Map<string, Relationship>()

    if (!document) {
      return relationships
    }

    for (const element of descendants(document, NS.rels, 'Relationship')) {
      const id = element.getAttribute('Id')
      const target = element.getAttribute('Target')
      const type = element.getAttribute('Type') ?? ''

      if (!id || !target || element.getAttribute('TargetMode') === 'External') {
        continue
      }

      relationships.set(id, { type, path: resolvePartPath(folder, target) })
    }

    return relationships
  }
}

export interface Relationship {
  /** The relationship's type URI; its last segment says what it is (`slideLayout`, `image`, …). */
  readonly type: string
  readonly path: string
}

/** Whether a relationship is of the given kind (the last segment of its type URI). */
export function isRelationshipOf(relationship: Relationship, kind: string): boolean {
  return relationship.type.endsWith(`/${kind}`)
}

/** Resolves a relationship target against the folder of the part that names it. */
export function resolvePartPath(folder: string, target: string): string {
  const segments = (target.startsWith('/') ? target.slice(1) : folder + target).split('/')
  const resolved: string[] = []

  for (const segment of segments) {
    if (segment === '..') {
      resolved.pop()
    } else if (segment !== '.' && segment !== '') {
      resolved.push(segment)
    }
  }

  return resolved.join('/')
}

// --- Element helpers, written against DOM Level 2 only (so any XML DOM works) ---

/** The element children of a node, optionally only those with this name in this namespace. */
export function children(node: Node | undefined, namespace?: string, name?: string): Element[] {
  if (!node) {
    return []
  }

  const found: Element[] = []

  for (let index = 0; index < node.childNodes.length; index += 1) {
    const childNode = node.childNodes[index]

    if (!childNode || childNode.nodeType !== 1) {
      continue
    }

    const element = childNode as Element

    if (
      (namespace === undefined || element.namespaceURI === namespace) &&
      (name === undefined || element.localName === name)
    ) {
      found.push(element)
    }
  }

  return found
}

/** The first element child with this name in this namespace. */
export function child(node: Node | undefined, namespace: string, name: string): Element | undefined {
  return children(node, namespace, name)[0]
}

/** Follows a path of `[namespace, name]` steps from a node, one child at a time. */
export function childAt(
  node: Node | undefined,
  ...steps: readonly (readonly [string, string])[]
): Element | undefined {
  let current: Node | undefined = node

  for (const [namespace, name] of steps) {
    current = child(current, namespace, name)
  }

  return current as Element | undefined
}

/** Every descendant element with this name in this namespace, in document order. */
export function descendants(node: Document | Element, namespace: string, name: string): Element[] {
  return Array.from(node.getElementsByTagNameNS(namespace, name))
}

/** An attribute as an integer, or `undefined` when it is missing or not a number. */
export function intAttribute(element: Element | undefined, name: string): number | undefined {
  const value = element?.getAttribute(name)

  if (value === null || value === undefined || value === '') {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) ? parsed : undefined
}

/** An OOXML boolean attribute (`1`/`true`/`on`), or `undefined` when it is not set. */
export function boolAttribute(element: Element | undefined, name: string): boolean | undefined {
  const value = element?.getAttribute(name)

  if (value === null || value === undefined || value === '') {
    return undefined
  }

  return value === '1' || value === 'true' || value === 'on'
}
