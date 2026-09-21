import type { ComponentProps } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewProps {
  readonly text: string
}

/** The only link targets a rendered document may point at. */
const ALLOWED_LINK_PROTOCOLS: ReadonlySet<string> = new Set([
  'http:',
  'https:',
  'mailto:',
])

/**
 * Decides which URLs from the document survive rendering. Only absolute
 * http(s) and mailto links do: a `javascript:` or `data:` link is dropped, and
 * so is a relative one, which would resolve against the extension's own origin
 * and navigate the dashboard to a page that does not exist. Returning
 * `undefined` removes the attribute, leaving the text without a link.
 */
function transformUrl(url: string): string | undefined {
  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(url).protocol) ? url : undefined
  } catch {
    return undefined
  }
}

/**
 * Element renderers. The document is untrusted input from the user's disk, so:
 * links open in a new tab that cannot reach back to the dashboard, and images
 * are not loaded at all — fetching a remote image would tell whoever hosts it
 * that the file was opened. An image shows as its alt text instead. (Raw HTML
 * is dealt with by `skipHtml` below.)
 */
const COMPONENTS: Components = {
  a: ({ href, children }: ComponentProps<'a'>) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-blue-700 underline underline-offset-2"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: ({ alt }: ComponentProps<'img'>) => (
    <span className="italic text-muted-foreground">
      {alt ? `[Image: ${alt}]` : '[Image]'}
    </span>
  ),
  h1: ({ children }) => (
    <h1 className="mt-6 mb-3 text-2xl font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 mb-3 border-b border-border pb-1 text-xl font-semibold first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 mb-2 text-lg font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-2 text-base font-semibold first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-4 mb-2 text-sm font-semibold first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-4 mb-2 text-sm font-semibold text-muted-foreground first:mt-0">
      {children}
    </h6>
  ),
  p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
  ul: ({ children, className }) => (
    <ul
      className={
        className?.includes('contains-task-list')
          ? 'my-3 space-y-1'
          : 'my-3 list-disc space-y-1 pl-6'
      }
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-border pl-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  pre: ({ children }) => (
    <pre className="scroll-slim my-3 overflow-x-auto rounded-lg bg-muted p-3 text-sm leading-6">
      {children}
    </pre>
  ),
  code: ({ children, className }) => (
    // A fenced block has a `language-*` class (or sits inside <pre>, which
    // supplies the block styling); inline code gets a pill.
    <code
      className={
        className
          ? `${className} font-mono`
          : 'rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]'
      }
    >
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="scroll-slim my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-3 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-1.5">{children}</td>
  ),
  input: ({ checked }) => (
    // GitHub-style task list item; shown, never editable.
    <input
      type="checkbox"
      checked={Boolean(checked)}
      disabled
      readOnly
      className="mr-2 align-middle"
    />
  ),
}

/**
 * Renders a Markdown document (with GitHub-flavoured tables, task lists, and
 * strikethrough) as styled, read-only content. Pure presentation: the text is
 * passed in, already read and size-limited by the caller.
 *
 * Raw HTML in the document is dropped (`skipHtml`), never rendered: it could
 * carry scripts, frames, or remote images. Only the tags go — the text between
 * inline tags (`<kbd>Ctrl</kbd>`) stays — and it is not shown as visible
 * markup either, which would clutter every README that opens with an HTML
 * banner or contains comments.
 */
export function MarkdownView({ text }: MarkdownViewProps) {
  return (
    <div className="break-words text-sm text-card-foreground">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={COMPONENTS}
        urlTransform={transformUrl}
        skipHtml
      >
        {text}
      </Markdown>
    </div>
  )
}
