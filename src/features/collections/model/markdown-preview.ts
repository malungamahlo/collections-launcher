/**
 * The most of a Markdown file that is rendered. Rendering builds a React
 * element for every block, and its cost grows faster than the file does, so an
 * enormous file would freeze the dashboard; a file past this size is shown up
 * to the limit, with a note saying so.
 *
 * Chosen by measuring in a real browser: a realistic document (headings, code,
 * tables, lists) rendered in about 1.5 s at 200 KB and 3.7 s at 800 KB, but
 * content four times denser than a real changelog took 5 s at 200 KB and nearly
 * a minute at 400 KB. 200 KB shows almost every real document whole and keeps
 * even the worst case to a few seconds. (A multiple of 1024, so it reads as a
 * round "200 KB" in the note the viewer shows.)
 */
export const MARKDOWN_PREVIEW_MAX_BYTES = 200 * 1024
