import type Stripe from 'stripe'
import type { ActivationResult } from './auction'
import { APP_TAG } from './stripe'

/**
 * Every decision the Stripe webhook makes, with the database and Stripe behind
 * an interface.
 *
 * This lives apart from the route for one reason: it is the code that decides
 * whether somebody's money is kept or given back, and that decision has to be
 * testable without a database, a network or a Stripe account. The route is
 * reduced to wiring — read the body, verify the signature, build the deps, map
 * the outcome to a status code.
 *
 * The rules it enforces, in full:
 *
 *   1. A bid becomes the standing bid ONLY on `payment_intent.succeeded`, and
 *      only after the intent is confirmed to be the one that bid created.
 *   2. Being outbid is never refunded. The money bought the time the logo spent
 *      on the ass, and that time happened.
 *   3. Money is returned in exactly one situation: the payment cleared but the
 *      logo never went on, because somebody was already higher, or the zone had
 *      closed, or the bid had been abandoned before the card came good.
 *   4. Anything the handler is not certain about leaves the money alone and
 *      says so loudly. Refunding on a state we do not understand is how a
 *      shared Stripe account turns into refunded invoices for another app.
 */

/* -------------------------------------------------------------------------- */
/*  Ports                                                                     */
/* -------------------------------------------------------------------------- */

/** The parts of a bid row this handler is allowed to reason about. */
export interface BidPaymentRecord {
  id: number
  amountCents: number
  status: string
  paymentIntentId: string | null
}

export interface WebhookDeps {
  /**
   * Takes the claim on an event id. `'claimed'` means this delivery owns the
   * work; `'duplicate'` means another delivery already finished it.
   */
  claimEvent(event: { id: string; type: string }): Promise<'claimed' | 'duplicate'>
  /** Stamps the claim finished. Called only after the work actually succeeded. */
  completeEvent(eventId: string): Promise<void>
  /** Drops the claim so Stripe's retry gets a real second attempt. */
  releaseEvent(eventId: string): Promise<void>

  loadBid(bidId: number): Promise<BidPaymentRecord | null>
  /** Records paid_at, and backfills the intent id if the bid has none yet. */
  recordPayment(bidId: number, paymentIntentId: string): Promise<void>
  activateBid(bidId: number): Promise<ActivationResult>
  cancelBid(bidId: number): Promise<void>
  refund(paymentIntentId: string): Promise<void>
  markRefunded(bidId: number): Promise<void>
  log?: (message: string, ...rest: unknown[]) => void
}

export type WebhookOutcome =
  /** Already handled by an earlier delivery. */
  | { status: 'duplicate' }
  /** Not a brandmyass payment, or an event type this app does not act on. */
  | { status: 'ignored'; reason: string }
  /** The bid is now (or was already) the standing bid. */
  | { status: 'activated'; bidId: number }
  /** Paid, never displayed, money returned. */
  | { status: 'refunded'; bidId: number }
  /** Paid, displayed, later outbid. Keeps the money, by design. */
  | { status: 'kept'; bidId: number }
  /** A pending bid was marked abandoned. */
  | { status: 'cancelled'; bidId: number }
  /** Something did not add up. Nothing was moved; a human should look. */
  | { status: 'mismatch'; reason: string }

/* -------------------------------------------------------------------------- */
/*  Ownership                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Is this PaymentIntent one of ours, and which bid is it for?
 *
 * This check is not paranoia, it is load-bearing. Stripe webhook endpoints are
 * scoped to an ACCOUNT, not to an application: every endpoint on the account
 * receives every event of the types it subscribed to. brandmyass shares a
 * Stripe account with the LeadNet dashboard, so `payment_intent.succeeded` for
 * a dashboard invoice arrives here too. A handler that assumed every intent it
 * saw was a bid would, at best, log noise — and if it ever decided to refund on
 * an unrecognised state, it would refund the dashboard's customers.
 *
 * So: an intent is ours only if we stamped it as ours. `bid_id` alone is not
 * enough of a signature.
 */
export function bidIdFromIntent(intent: Stripe.PaymentIntent): number | null {
  if (intent.metadata?.app !== APP_TAG) return null
  const raw = intent.metadata?.bid_id
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/* -------------------------------------------------------------------------- */
/*  The handler                                                               */
/* -------------------------------------------------------------------------- */

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: WebhookDeps,
): Promise<WebhookOutcome> {
  const log = deps.log ?? console.log

  if ((await deps.claimEvent({ id: event.id, type: event.type })) === 'duplicate') {
    return { status: 'duplicate' }
  }

  try {
    const outcome = await dispatch(event, deps, log)
    await deps.completeEvent(event.id)
    return outcome
  } catch (err) {
    // The claim is dropped rather than completed, so Stripe's retry re-runs the
    // work instead of being told it is a duplicate. That is what makes a failed
    // refund get another attempt in a few minutes rather than a log line.
    await deps.releaseEvent(event.id).catch(() => {})
    throw err
  }
}

async function dispatch(
  event: Stripe.Event,
  deps: WebhookDeps,
  log: (message: string, ...rest: unknown[]) => void,
): Promise<WebhookOutcome> {
  switch (event.type) {
    case 'payment_intent.succeeded':
      return onSucceeded(event.data.object as Stripe.PaymentIntent, deps, log)

    case 'payment_intent.payment_failed': {
      // Deliberately does NOT cancel the bid.
      //
      // `payment_intent.payment_failed` is not terminal. It fires on every
      // declined attempt, and the PaymentIntent goes straight back to
      // requires_payment_method so the customer can try another card on the
      // same client secret — which is exactly what the Payment Element invites
      // them to do. Cancelling here meant a bidder who mistyped a card once and
      // then paid successfully had their bid already marked abandoned, so the
      // succeeded event that followed could not promote them: charged, no
      // placement. The intent's real end is payment_intent.canceled, below.
      const intent = event.data.object as Stripe.PaymentIntent
      const bidId = bidIdFromIntent(intent)
      if (bidId == null) return { status: 'ignored', reason: 'not a brandmyass payment' }
      log(`[webhook] bid ${bidId}: an attempt was declined; leaving it open for a retry`)
      return { status: 'ignored', reason: 'attempt declined, intent still open' }
    }

    case 'payment_intent.canceled': {
      const intent = event.data.object as Stripe.PaymentIntent
      const bidId = bidIdFromIntent(intent)
      if (bidId == null) return { status: 'ignored', reason: 'not a brandmyass payment' }
      // Only ever touches a bid still in `pending` — a cancelled intent cannot
      // have paid for anything, and a standing bid must not be knocked off by
      // one.
      await deps.cancelBid(bidId)
      return { status: 'cancelled', bidId }
    }

    default:
      return { status: 'ignored', reason: `unhandled type ${event.type}` }
  }
}

async function onSucceeded(
  intent: Stripe.PaymentIntent,
  deps: WebhookDeps,
  log: (message: string, ...rest: unknown[]) => void,
): Promise<WebhookOutcome> {
  const bidId = bidIdFromIntent(intent)
  if (bidId == null) return { status: 'ignored', reason: 'not a brandmyass payment' }

  const bid = await deps.loadBid(bidId)
  if (!bid) {
    // Metadata pointing at a bid that does not exist. The money is NOT refunded
    // on a guess: we cannot tell from here whether this is our payment with a
    // bad id or somebody else's payment wearing our tag, and refunding the
    // wrong one is unrecoverable. Loud log, human decides.
    log(`[webhook] MISMATCH: intent ${intent.id} names bid ${bidId}, which does not exist`)
    return { status: 'mismatch', reason: 'unknown bid' }
  }

  // The intent must be the one this bid created. Without this, anything that
  // could put a bid_id into metadata could promote a bid using a payment that
  // belonged to something else entirely.
  if (bid.paymentIntentId && bid.paymentIntentId !== intent.id) {
    log(
      `[webhook] MISMATCH: bid ${bidId} was charged on ${bid.paymentIntentId}, not ${intent.id}. Not promoting.`,
    )
    return { status: 'mismatch', reason: 'payment intent does not belong to this bid' }
  }

  // And it must be for the money the bid actually asked for. A cheaper intent
  // must never buy a more expensive placement.
  const paid = intent.amount_received || intent.amount
  if (paid !== bid.amountCents) {
    log(
      `[webhook] MISMATCH: bid ${bidId} is ${bid.amountCents} cents, intent ${intent.id} paid ${paid}. Not promoting.`,
    )
    return { status: 'mismatch', reason: 'amount does not match the bid' }
  }

  await deps.recordPayment(bidId, intent.id)

  const result = await deps.activateBid(bidId)

  switch (result.outcome) {
    case 'activated':
      if (result.displacedBidId) {
        // Not refunded, and this is the whole model in one line: the displaced
        // sponsor paid for the time their logo was up, and they had it.
        log(`[webhook] bid ${bidId} displaced bid ${result.displacedBidId} — no refund, as designed`)
      }
      if (result.extended) {
        log(`[webhook] anti-snipe: bid ${bidId} pushed close to ${result.newClosesAt}`)
      }
      return { status: 'activated', bidId }

    case 'already_displayed':
      // Paid, went on, has since been outbid. Nothing to do and nothing to
      // give back. Reachable when an event is redelivered after its claim was
      // dropped by an unrelated failure.
      return { status: 'kept', bidId }

    case 'too_late': {
      // The one refund path. This logo never went on: somebody was already
      // higher, or the zone closed, or the bid was abandoned before the card
      // came good. Nothing was sold, so nothing is kept.
      //
      // A throw here is deliberate. It drops the event claim and returns 500,
      // so Stripe retries and the refund is attempted again — a failed refund
      // is somebody out of pocket for nothing, which is worth three days of
      // retries rather than a log line nobody reads.
      await deps.refund(intent.id)
      await deps.markRefunded(bidId)
      log(`[webhook] bid ${bidId} paid too late to be displayed — refunded in full`)
      return { status: 'refunded', bidId }
    }

    case 'unknown_bid':
      log(`[webhook] MISMATCH: bid ${bidId} vanished between load and activation`)
      return { status: 'mismatch', reason: 'unknown bid' }
  }
}
