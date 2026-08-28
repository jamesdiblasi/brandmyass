import { CURRENCY_SYMBOL } from './config'

/**
 * Cents in, human-readable string out. The whole app stores integers; this is
 * the only sanctioned exit from that.
 */
export function formatMoney(cents: number, opts: { cents?: boolean } = {}): string {
  const showCents = opts.cents ?? cents % 100 !== 0
  const value = (cents / 100).toLocaleString('en-AU', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  })
  return `${CURRENCY_SYMBOL}${value}`
}

/**
 * Parses whatever a human typed into a bid box into cents. Deliberately
 * forgiving about "$", thousands separators and stray spaces, and deliberately
 * unforgiving about everything else — a bid that cannot be read exactly is
 * rejected rather than guessed at, because guessing costs somebody money.
 */
export function parseMoneyToCents(input: string): number | null {
  // Strip a leading $, thousands separators, and surrounding whitespace — but
  // NOT whitespace inside the number. Stripping that turned "40 0" into $400,
  // which is a typo silently becoming a tenfold bid.
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, frac = ''] = cleaned.split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}
