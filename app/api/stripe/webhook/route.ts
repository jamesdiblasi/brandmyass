import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { activateBid, cancelBid } from '@/lib/auction'
import { releaseHold, verifyWebhook } from '@/lib/stripe'
import { query, queryOne } from '@/lib/db'

// The signature is computed over the exact bytes Stripe sent. Any parsing or
// transformation before verification breaks it, so the body is read as text.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The only place a bid is allowed to become the standing bid.
 *
 * A bid is a promise until the card says otherwise. `payment_intent.
 * amount_capturable_updated` is Stripe's way of saying "the funds are held and
 * capturable" for a manual-capture intent, and that — not the browser
 * reporting success — is what promotes a bid. Trusting the client here would
 * let anyone take a placement off the market for free.
 */
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

  // Idempotency. Stripe retries for up to three days, and a replayed
  // activation must not release a second person's hold. The insert either wins
  // the race or tells us this event was already handled.
  const inserted = await queryOne<{ id: string }>(
    `insert into webhook_events (id, type) values ($1, $2)
     on conflict (id) do nothing
     returning id`,
    [event.id, event.type],
  )
  if (!inserted) return NextResponse.json({ received: true, duplicate: true })

  try {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated': {
        const intent = event.data.object as Stripe.PaymentIntent
        const bidId = Number(intent.metadata?.bid_id)
        if (!Number.isSafeInteger(bidId)) break

        const result = await activateBid(bidId)

        if (result.outcome === 'activated') {
          // Whoever we just displaced gets their money unfrozen. This is the
          // single most important line on the site from a bidder's point of
          // view, so a failure here is logged loudly rather than swallowed.
          if (result.releasePaymentIntentId) {
            await releaseHold(result.releasePaymentIntentId).catch((err) =>
              console.error('[webhook] FAILED to release outbid hold', result.releasePaymentIntentId, err),
            )
          }
          if (result.extended) {
            console.log(`[webhook] anti-snipe: bid ${bidId} pushed close to ${result.newClosesAt}`)
          }
        } else if (result.outcome === 'too_late') {
          // Authorised, but somebody went higher while the card was clearing.
          // Give it straight back.
          await releaseHold(intent.id).catch((err) =>
            console.error('[webhook] FAILED to release late hold', intent.id, err),
          )
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent
        const bidId = Number(intent.metadata?.bid_id)
        if (Number.isSafeInteger(bidId)) await cancelBid(bidId)
        break
      }

      case 'payment_intent.canceled': {
        const intent = event.data.object as Stripe.PaymentIntent
        const bidId = Number(intent.metadata?.bid_id)
        if (Number.isSafeInteger(bidId)) {
          await cancelBid(bidId)
          await query(
            `update bids set hold_released_at = coalesce(hold_released_at, now()), updated_at = now()
             where stripe_payment_intent_id = $1`,
            [intent.id],
          )
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[webhook] handler failed for', event.type, err)
    // Drop the idempotency record so Stripe's retry gets a real second attempt
    // rather than being told "already handled" for work that never happened.
    await query('delete from webhook_events where id = $1', [event.id]).catch(() => {})
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
