import { normalizeWebsiteUrl, WebsiteUrlError } from './website-url'

/** Maximum supported length for a website's friendly name. */
export const WEBSITE_NAME_MAX_LENGTH = 100

/** Returns a user-facing validation message for a website name. */
export function getWebsiteNameValidationError(
  value: string,
): string | undefined {
  const normalizedName = value.trim()

  if (!normalizedName) {
    return 'Enter a website name.'
  }

  if (normalizedName.length > WEBSITE_NAME_MAX_LENGTH) {
    return `Website names must be ${WEBSITE_NAME_MAX_LENGTH} characters or fewer.`
  }

  return undefined
}

/** Trims and returns a valid friendly name or rejects invalid domain input. */
export function normalizeWebsiteName(value: string): string {
  const validationError = getWebsiteNameValidationError(value)

  if (validationError) {
    throw new TypeError(validationError)
  }

  return value.trim()
}

/**
 * Returns whether two website names are the same name, for the purpose of
 * enforcing that every resource's name is unique within a collection.
 * Ignores case and surrounding whitespace.
 */
export function websiteNamesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Converts typed URL failures into concise form validation messages. */
export function getWebsiteUrlValidationError(
  value: string,
): string | undefined {
  try {
    normalizeWebsiteUrl(value)
    return undefined
  } catch (error) {
    if (!(error instanceof WebsiteUrlError)) {
      throw error
    }

    switch (error.code) {
      case 'EMPTY_URL':
        return 'Enter a website URL.'
      case 'INVALID_URL':
        return 'Enter a valid website URL.'
      case 'UNSUPPORTED_PROTOCOL':
        return 'Website URL must use HTTP or HTTPS.'
    }
  }
}
