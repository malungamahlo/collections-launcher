/**
 * How much of a large document the browser view shows. Kept apart from the
 * readers so the views can say what was left out without loading a reader.
 * The whole document is always one click away in its own application.
 */

/** Rows and columns shown of each sheet: a bigger grid is slow to draw and nobody reads it on screen. */
export const SPREADSHEET_MAX_ROWS = 1_000
export const SPREADSHEET_MAX_COLUMNS = 100

/** Slides shown of a presentation. */
export const PRESENTATION_MAX_SLIDES = 200
