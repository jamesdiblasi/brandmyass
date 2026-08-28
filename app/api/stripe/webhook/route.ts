import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { activateBid, cancelBid } from '@/lib/auction'
import { verifyWebhook } from '@/lib/stripe'
import { handleStripeEvent, type BidPaymentRecord, type WebhookDeps } from '@/lib/webhook'
import { query, queryOne } from '@/lib/db'

// The signature is computed over the exact bytes Stripe sent. Any parsing or
// transformation before verification breaks it, so the body is read as text.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The only place a bid is allowed to become the standing bid.
 *
 * A bid is a promise until the card says otherwise. `payment_intent.succeeded`
 * is Stripe confirming the money actually moved, and that — not the browser
 * reporting success — is what promotes a bid. Trusting the client here would
 * let anyone take a placement off the market for free.
 *
 * This file is deliberately only wiring. Every decision about whose money is
 * kept and whose is returned lives in lib/webhook.ts, where it is tested
 * against mocks rather than against a live Stripe account and a live database.
 */

/** How long a claim may sit unfinished before a redelivery may take it over. */
const STALE_CLAIM = '5 minutes'

const deps: WebhookDeps = {
  /**
   * The idempotency gate, as a claim rather than a receipt.
   *
   * The plain `insert … on conflict do nothing` version was correct only while
   * the handler either finished or threw. If the process died in between — an
   * App Service restart, an instance recycle — the row was committed, the work
   * never happened, and Stripe's redelivery got told "already handled". Here
   * that is a payment taken and no logo put on anyone.
   *
   * So the insert takes a claim, `completeEvent` stamps it done, and a claim
   * that is both unfinished and older than a handler could plausibly still be
   * running is reclaimable. Both writes are single statements, so two
   * simultaneous deliveries cannot both win.
   */
  async claimEvent(event) {
    const fresh = await queryOne<{ id: string }>(
      `insert into webhook_events (id, type) values ($1, $2)
       on conflict (id) do nothing
       returning id`,
      [event.id, event.type],
    )
    if (fresh) return 'claimed'

    const reclaimed = await queryOne<{ id: string }>(
      `update webhook_events
       set received_at = now()
       where id = $1
         and handled_at is null
         and received_at < now() - interval '${STALE_CLAIM}'
       returning id`,
      [event.id],
    )
    if (reclaimed) {
      console.warn(`[webhook] retrying ${event.id}: an earlier delivery claimed it and never finished`)
      return 'claimed'
    }
    return 'duplicate'
  },

  async completeEvent(eventId) {
    await query('update webhook_events set handled_at = now() where id = $1', [eventId])
  },

  async releaseEvent(eventId) {
    await query('delete from webhook_events where id = $1', [eventId])
  },

  async loadBid(bidId) {
    const row = await queryOne<{
      id: number
      amount_cents: number
      status: string
      stripe_payment_intent_id: string | null
    }>('select id, amount_cents, status, stripe_payment_intent_id from bids where id = $1', [bidId])
    if (!row) return null
    const bid: BidPaymentRecord = {
      id: row.id,
      amountCents: row.amount_cents,
      status: row.status,
      paymentIntentId: row.stripe_payment_intent_id,
    }
    return bid
  },

  async recordPayment(bidId, paymentIntentId) {
    // `coalesce` on both columns: paid_at records when the money first cleared,
    // not when a redelivery was processed, and the intent id is only ever
    // backfilled — the handler has already refused to act on a mismatch, so an
    // existing value here is the right one and is left alone.
    await query(
      `update bids
       set paid_at = coalesce(paid_at, now()),
           stripe_payment_intent_id = coalesce(stripe_payment_intent_id, $2),
           updated_at = now()
       where id = $1`,
      [bidId, paymentIntentId],
    )
  },

  activateBid,
  cancelBid,

  async flagRefundDue(bidId) {
    await query(
      'update bids set refund_due_at = coalesce(refund_due_at, now()), updated_at = now() where id = $1',
      [bidId],
    )
  },
}

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = verifyWebhook(rawBody, signature)
  } catch (err) {
    console.error('[webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    const outcome = await handleStripeEvent(event, deps)
    return NextResponse.json({ received: true, ...outcome })
  } catch (err) {
    // 500 buys three days of Stripe retries. The handler has already released
    // its claim, so a retry is a genuine second attempt — which is the point:
    // the failure this most often covers is a refund that did not go through,
    // and that is somebody out of pocket for nothing until it does.
    console.error('[webhook] handler failed for', event.type, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
