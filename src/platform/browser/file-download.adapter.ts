/**
 * Defines file-download behavior needed by application code.
 */
export interface FileDownloadAdapter {
  download(fileName: string, contents: string, mimeType?: string): void
}

/**
 * Downloads text content as a file using a `Blob`, an object URL, and a
 * programmatic `<a download>` click, entirely inside the extension's own
 * page. This needs no `downloads` permission.
 */
export class BrowserFileDownloadAdapter implements FileDownloadAdapter {
  download(
    fileName: string,
    contents: string,
    mimeType = 'application/json',
  ): void {
    const blob = new Blob([contents], { type: mimeType })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = objectUrl
    anchor.download = fileName
    anchor.click()

    // Deferred so the click has been processed before the URL is revoked.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }
}
