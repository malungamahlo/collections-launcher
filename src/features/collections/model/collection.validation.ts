/** Maximum supported length for a collection's visible name. */
export const COLLECTION_NAME_MAX_LENGTH = 80

/**
 * Returns a user-facing validation message for an invalid collection name.
 */
export function getCollectionNameValidationError(
  value: string,
): string | undefined {
  const normalizedName = value.trim()

  if (!normalizedName) {
    return 'Enter a collection name.'
  }

  if (normalizedName.length > COLLECTION_NAME_MAX_LENGTH) {
    return `Collection names must be ${COLLECTION_NAME_MAX_LENGTH} characters or fewer.`
  }

  return undefined
}

/**
 * Trims and returns a valid collection name or rejects invalid domain input.
 */
export function normalizeCollectionName(value: string): string {
  const validationError = getCollectionNameValidationError(value)

  if (validationError) {
    throw new TypeError(validationError)
  }

  return value.trim()
}
