/**
 * Defines file-download behavior needed by application code.
 */
export interface FileDownloadAdapter {
  /**
   * Saves `contents` as a file the user can see and keep. Text is wrapped in a
   * `Blob` of `mimeType`; a `Blob` is saved as it is, with its own type.
   */
  download(fileName: string, contents: string | Blob, mimeType?: string): void
}

/**
 * Downloads content as a file using a `Blob`, an object URL, and a
 * programmatic `<a download>` click, entirely inside the extension's own
 * page. This needs no `downloads` permission, and it is an ordinary, visible
 * browser download — exactly what an export or an explicit "Save a copy"
 * should be. (The hidden temporary copy used to open a file in another
 * application is a different mechanism: `ExternalOpenAdapter`.)
 */
export class BrowserFileDownloadAdapter implements FileDownloadAdapter {
  download(
    fileName: string,
    contents: string | Blob,
    mimeType = 'application/json',
  ): void {
    const blob =
      typeof contents === 'string'
        ? new Blob([contents], { type: mimeType })
        : contents
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = objectUrl
    anchor.download = fileName
    anchor.click()

    // Deferred so the click has been processed before the URL is revoked.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }
}
