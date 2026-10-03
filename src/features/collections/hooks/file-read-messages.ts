import type { FileContentErrorCode } from '@app/platform/browser/file-content.adapter'

/**
 * What to tell the user when a file resource's content could not be read in
 * order to show it. The storage adapter's own error messages are for logs, not
 * for people, so the wording lives here, chosen by the error's code.
 */
export function describeFileReadFailure(
  resourceName: string,
  code: FileContentErrorCode,
): string {
  switch (code) {
    case 'NOT_FOUND':
      return `"${resourceName}" could not be found. It may have been moved, renamed, or deleted.`
    case 'PERMISSION_DENIED':
      return `Access to "${resourceName}" was not granted. Choose Try again and allow access when the browser asks.`
    case 'UNAVAILABLE':
      return `"${resourceName}" could not be opened. Try again.`
  }
}

/** What to tell the user when a file resource could not be saved as a copy. */
export function describeFileSaveFailure(
  resourceName: string,
  code: FileContentErrorCode,
): string {
  switch (code) {
    case 'NOT_FOUND':
      return `"${resourceName}" could not be found, so there is nothing to save. It may have been moved, renamed, or deleted.`
    case 'PERMISSION_DENIED':
      return `Access to "${resourceName}" was not granted. Choose Save a copy again and allow access when the browser asks.`
    case 'UNAVAILABLE':
      return `"${resourceName}" could not be saved. Try again.`
  }
}

/** Why a file that was read could still not be shown in the browser. */
export type CannotDisplayReason = 'too-large' | 'unreadable'

/**
 * What to tell the user when a file was read but cannot be shown in the
 * browser — too large to draw, or not what its type says. Its application is
 * the way to see it, so the message says which one.
 */
export function describeCannotDisplay(
  resourceName: string,
  reason: CannotDisplayReason,
  appName: string | undefined,
): string {
  const instead = appName
    ? ` Open it in ${appName} from your collections instead.`
    : ''

  return reason === 'too-large'
    ? `"${resourceName}" is too large to show here.${instead}`
    : `"${resourceName}" can't be shown here — it may be damaged or in a form this view doesn't read.${instead}`
}
