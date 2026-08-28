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
 * Share of the bid taken as a card hold when bidding. It is authorised, not
 * captured — an outbid bidder's hold is released and they are never charged.
 * The winner's hold is captured and the balance invoiced separately.
 */
export const DEPOSIT_PERCENT = 20
export const MIN_DEPOSIT_CENTS = 1_000 // $10, Stripe dislikes trivial holds

/**
 * Anti-snipe. A bid landing inside the window pushes the close out, so the
 * auction cannot be stolen in the last four seconds by someone with a faster
 * connection than yours. Bids extend to `now + EXTENSION`, they do not stack.
 */
export const ANTI_SNIPE_WINDOW_MS = 5 * 60 * 1000
export const ANTI_SNIPE_EXTENSION_MS = 5 * 60 * 1000

/** How often the front end re-reads auction state. */
export const POLL_INTERVAL_MS = 8_000

/**
 * A card hold cannot be left open forever — Stripe expires uncaptured
 * PaymentIntents after 7 days. Auctions longer than this need the settle job
 * to re-authorise, which is why the default campaign is deliberately short.
 */
export const MAX_HOLD_DAYS = 7

export const SITE = {
  name: 'Brand My Ass',
  domain: 'brandmyass.com',
  tagline: 'Premium out-of-home advertising. On my arse.',
  /** Where Stripe sends people back to. Set PUBLIC_BASE_URL in production. */
  baseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3002',
  contactEmail: 'sponsors@brandmyass.com',
}
