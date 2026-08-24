/** Protocols that website resources are allowed to use. */
const SUPPORTED_WEBSITE_PROTOCOLS = new Set(['http:', 'https:'])

const EXPLICIT_PROTOCOL_PATTERN = /^[a-z][a-z\d+.-]*:/i

/** Stable error categories that presentation code can handle later. */
export type WebsiteUrlErrorCode =
  | 'EMPTY_URL'
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROTOCOL'

/**
 * Describes why a website URL could not be accepted.
 * The error code allows the UI to display an appropriate message later.
 */
export class WebsiteUrlError extends TypeError {
  constructor(
    readonly code: WebsiteUrlErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'WebsiteUrlError'
  }
}

/**
 * Trims, validates, and converts a website address into a consistent URL.
 * Addresses without a protocol default to HTTPS.
 */
export function normalizeWebsiteUrl(value: string): string {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    throw new WebsiteUrlError('EMPTY_URL', 'Website URL cannot be empty')
  }

  const candidateUrl = EXPLICIT_PROTOCOL_PATTERN.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`

  let parsedUrl: URL

  try {
    parsedUrl = new URL(candidateUrl)
  } catch {
    throw new WebsiteUrlError('INVALID_URL', 'Enter a valid website URL')
  }

  if (!SUPPORTED_WEBSITE_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new WebsiteUrlError(
      'UNSUPPORTED_PROTOCOL',
      'Website URL must use HTTP or HTTPS',
    )
  }

  return parsedUrl.toString()
}

/**
 * Extracts a short, readable domain from a valid website URL.
 * A malformed value is returned unchanged so rendering never crashes.
 */
export function getReadableWebsiteDomain(value: string): string {
  try {
    const hostname = new URL(value).hostname
    return hostname.replace(/^www\./, '') || value
  } catch {
    return value
  }
}
