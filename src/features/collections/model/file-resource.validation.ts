/**
 * The largest file that can be added as a resource: 100 MB.
 *
 * A locally added file is stored as a reference, so this does not bound what
 * the extension stores. It bounds what opening a file costs — handing a file
 * to the OS's installed application means reading its bytes into memory — and
 * it is the same ceiling that keeps a future attachment bundle from growing
 * without limit.
 */
export const MAX_FILE_RESOURCE_SIZE_BYTES = 100 * 1024 * 1024

/**
 * Returns a user-facing validation message for a file's size, or `undefined`
 * when it can be added. An empty file is allowed; a size that isn't a
 * non-negative whole number means the file's size could not be read reliably.
 */
export function getFileSizeValidationError(
  sizeBytes: number,
): string | undefined {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    return 'This file’s size could not be determined.'
  }

  if (sizeBytes > MAX_FILE_RESOURCE_SIZE_BYTES) {
    return `Files must be ${MAX_FILE_RESOURCE_SIZE_BYTES / (1024 * 1024)} MB or smaller.`
  }

  return undefined
}
