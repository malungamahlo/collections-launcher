import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DashboardHeader } from './dashboard-header'

describe('DashboardHeader', () => {
  it('identifies the normal dashboard as device storage', () => {
    const markup = renderToStaticMarkup(<DashboardHeader />)

    expect(markup).toContain('Stored on this device')
    expect(markup).not.toContain('Development preview')
  })

  it('clearly identifies development sample data', () => {
    const markup = renderToStaticMarkup(
      <DashboardHeader isDevelopmentPreview />,
    )

    expect(markup).toContain('Development preview')
    expect(markup).not.toContain('Stored on this device')
  })
})
