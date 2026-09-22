import { useEffect } from 'react'

/**
 * Names the browser tab while the calling component is on screen, and puts the
 * previous name back when it goes away.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    return () => {
      document.title = previousTitle
    }
  }, [title])
}
