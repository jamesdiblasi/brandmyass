import Stripe from 'stripe'
import { CURRENCY } from './config'

/**
 * Stripe, in take-the-money mode.
 *
 * A bid is CHARGED IN FULL when it is placed. There is no hold, no deposit and
 * no capture step: the bidder pays, the logo goes on, and it comes off when
 * somebody pays more. The money buys display time, not a claim on the outcome,
 * so being outbid is not refunded.
 *
 * There is exactly one refund path, and it is not a courtesy. If a payment
 * confirms AFTER someone else has already gone higher, that logo never went on
 * the ass at all — nothing was sold, so the money goes back. Every other
 * outcome keeps the payment.
 */

// Pinned deliberately: without one, an account-level version bump silently
// reshapes webhook payloads underneath us. This is the version the installed
// SDK is typed against, and it is intentionally allowed to differ from the
// LeadNet dashboard's pin — same Stripe account, independently upgradable apps.
const API_VERSION = '2026-08-26.dahlia'

/**
 * Stamped into the metadata of every PaymentIntent this app creates, and
 * required by the webhook before it will act on one.
 *
 * Stripe webhook endpoints are scoped to an ACCOUNT, not to an application.
 * This app shares a Stripe account with the LeadNet dashboard, so this
 * endpoint's `payment_intent.succeeded` feed includes the dashboard's invoice
 * payments. Everything downstream of the signature check therefore has to be
 * able to answer "is this mine?", and a `bid_id` key anyone could also happen
 * to use is not an answer. See `bidIdFromIntent` in lib/webhook.ts.
 */
export const APP_TAG = 'brandmyass'

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
  cached = new Stripe(key, { apiVersion: API_VERSION })
  return cached
}

export interface ChargeParams {
  bidId: number
  zoneId: string
  zoneName: string
  amountCents: number
  sponsorName: string
  sponsorEmail: string
}

/**
 * Charges the full bid. Returns the client secret the browser needs to confirm
 * the card.
 *
 * Automatic capture — the money moves as soon as the card clears. The bid id
 * goes into metadata because the webhook has to map a payment back to a bid,
 * and metadata is the only field that survives the round trip intact.
 */
export async function chargeBid(
  params: ChargeParams,
): Promise<{ paymentIntentId: string; clientSecret: string }> {
  const stripe = getStripe()

  const intent = await stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency: CURRENCY,
      automatic_payment_methods: { enabled: true },
      receipt_email: params.sponsorEmail,
      description: `${params.zoneName} — ${params.sponsorName}`,
      statement_descriptor_suffix: 'BRANDMYASS',
      metadata: {
        app: APP_TAG,
        bid_id: String(params.bidId),
        zone_id: params.zoneId,
        zone_name: params.zoneName,
        sponsor_name: params.sponsorName,
      },
    },
    // Stripe deduplicates on this key, so a double-submitted bid form cannot
    // charge the same card twice for the same bid. This matters more now than
    // it did with holds: a duplicate here is real money taken twice.
    { idempotencyKey: `bid-charge-${params.bidId}` },
  )

  if (!intent.client_secret) throw new Error('Stripe returned a PaymentIntent with no client secret')
  return { paymentIntentId: intent.id, clientSecret: intent.client_secret }
}

/**
 * Refunds a payment in full.
 *
 * Used for exactly one case: a payment that confirmed after somebody had
 * already bid higher, so the logo never went on. Not used for ordinary
 * outbidding, which is not refundable.
 *
 * Refunding an already-refunded charge throws, and Stripe redelivers webhooks,
 * so that specific error is swallowed — money already returned staying returned
 * is the outcome we wanted.
 */
export async function refundPayment(paymentIntentId: string): Promise<void> {
  const stripe = getStripe()
  try {
    await stripe.refunds.create({ payment_intent: paymentIntentId })
  } catch (err) {
    const e = err as Stripe.errors.StripeError
    if (e?.code === 'charge_already_refunded') return
    throw err
  }
}

export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET')
  return getStripe().webhooks.constructEvent(rawBody, signature, secret)
}
