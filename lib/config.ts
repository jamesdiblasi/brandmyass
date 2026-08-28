/**
 * Every tunable number for the auction, in one place, so that changing the
 * rules is a config edit and not an archaeology expedition.
 *
 * Money is in MINOR UNITS (cents) everywhere in this codebase — database
 * columns, API payloads, Stripe amounts and this file. Floats are never used
 * for money. `lib/money.ts` is the only place allowed to turn cents into
 * something a human reads.
 */

export const CURRENCY = 'aud'
export const CURRENCY_SYMBOL = '$'

/** Smallest amount a new bid must clear the standing bid by. */
export const MIN_INCREMENT_CENTS = 1_000 // $10

/**
 * There is no deposit and no hold. A bid is CHARGED IN FULL the moment it is
 * placed, and it is not refunded when a later bidder takes the placement — the
 * money buys the time the logo actually spends on the ass, not a claim on the
 * final outcome.
 *
 * The single exception is a bid whose payment lands after somebody has already
 * gone higher. That logo never went on at all, so it is refunded in full. See
 * `activateBid` and the webhook.
 */

/**
 * Anti-snipe. A bid landing inside the window pushes the close out, so the
 * auction cannot be stolen in the last four seconds by someone with a faster
 * connection than yours. Bids extend to `now + EXTENSION`, they do not stack.
 */
export const ANTI_SNIPE_WINDOW_MS = 5 * 60 * 1000
export const ANTI_SNIPE_EXTENSION_MS = 5 * 60 * 1000

/** How often the front end re-reads auction state. */
export const POLL_INTERVAL_MS = 8_000

export const SITE = {
  name: 'Brand My Ass',
  domain: 'brandmyass.com',
  tagline: 'Premium out-of-home advertising. On my ass.',
  /** Where Stripe sends people back to. Set PUBLIC_BASE_URL in production. */
  baseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3002',
  contactEmail: 'sponsors@brandmyass.com',
}
