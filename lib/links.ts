/**
 * sponsor_url is typed by strangers and rendered as an href. React escapes
 * text, but an href is live: `javascript:` (or `data:`) executes on click, so
 * scheme-checking is the actual defence, not escaping.
 *
 * Checked twice on purpose — at bid creation so garbage never enters the
 * database, and at render so a row that predates the check (or arrives by any
 * other path) still cannot become a clickable payload.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}
