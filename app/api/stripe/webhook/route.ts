import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { activateBid, cancelBid } from '@/lib/auction'
import { refundPayment, verifyWebhook } from '@/lib/stripe'
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
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent
        const bidId = Number(intent.metadata?.bid_id)
        if (!Number.isSafeInteger(bidId)) break

        await query('update bids set paid_at = coalesce(paid_at, now()) where id = $1', [bidId])

        const result = await activateBid(bidId)

        if (result.outcome === 'activated') {
          // The displaced bid is NOT refunded. It paid for the time its logo
          // spent on the ass and it got that time.
          if (result.displacedBidId) {
            console.log(`[webhook] bid ${bidId} displaced bid ${result.displacedBidId} — no refund, as designed`)
          }
          if (result.extended) {
            console.log(`[webhook] anti-snipe: bid ${bidId} pushed close to ${result.newClosesAt}`)
          }
        } else if (result.outcome === 'too_late') {
          // Paid, but somebody went higher while the card was clearing, so this
          // logo never went on at all. Nothing was sold — give the money back.
          // A failure here means somebody is out of pocket for nothing, so it
          // is logged loudly rather than swallowed.
          await refundPayment(intent.id)
            .then(() => query('update bids set refunded_at = now() where id = $1', [bidId]))
            .catch((err) => console.error('[webhook] FAILED to refund a never-displayed bid', intent.id, err))
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
        if (Number.isSafeInteger(bidId)) await cancelBid(bidId)
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
