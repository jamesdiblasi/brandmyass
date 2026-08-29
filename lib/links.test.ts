import { describe, expect, it } from 'vitest'
import { safeHref } from './links'

/**
 * The href gate. Everything here ends up clickable on a public page, written
 * by strangers, so the failure mode is script execution — not a broken link.
 */
describe('safeHref', () => {
  it('passes ordinary web URLs through', () => {
    expect(safeHref('https://acme.com')).toBe('https://acme.com/')
    expect(safeHref('http://acme.com/path?q=1')).toBe('http://acme.com/path?q=1')
  })

  it('refuses executable and exotic schemes', () => {
    // eslint-disable-next-line no-script-url
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(safeHref('vbscript:x')).toBeUndefined()
    expect(safeHref('file:///etc/passwd')).toBeUndefined()
  })

  it('refuses things that are not URLs at all', () => {
    expect(safeHref('acme.com')).toBeUndefined() // no scheme — ambiguous, so no
    expect(safeHref('   ')).toBeUndefined()
    expect(safeHref(null)).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
  })
})
