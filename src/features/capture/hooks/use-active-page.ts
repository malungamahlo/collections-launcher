import { useEffect, useState } from 'react'
import type {
  ActivePageResult,
  ActiveTabAdapter,
} from '@app/platform/browser/active-tab.adapter'

/** Loading states exposed while the popup reads the active browser tab. */
export type ActivePageLoadState =
  | { readonly status: 'loading' }
  | ActivePageResult
  | { readonly status: 'error' }

/** Reads the active page once when the toolbar popup opens. */
export function useActivePage(
  adapter: ActiveTabAdapter,
): ActivePageLoadState {
  const [state, setState] = useState<ActivePageLoadState>({
    status: 'loading',
  })

  useEffect(() => {
    let active = true

    void adapter
      .getActivePage()
      .then(result => {
        if (active) {
          setState(result)
        }
      })
      .catch(error => {
        console.error('Could not read the active browser tab', error)

        if (active) {
          setState({ status: 'error' })
        }
      })

    return () => {
      active = false
    }
  }, [adapter])

  return state
}
