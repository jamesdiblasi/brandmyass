import Stripe from 'stripe'
import { CURRENCY } from './config'

/**
 * Stripe, in card-hold mode.
 *
 * The money model here is an AUTHORISATION, not a charge. A bid places a
 * manual-capture PaymentIntent for the deposit, which reserves the funds on the
 * bidder's card without taking them. Being outbid cancels the intent and the
 * hold vanishes; winning captures it. That is what makes "you are never charged
 * unless you win" a true statement rather than a marketing one, and it is why
 * nothing in this codebase ever issues a refund — there is nothing to refund.
 */

// Pinned deliberately: without one, an account-level version bump silently
// reshapes webhook payloads underneath us. This is the version the installed
// SDK is typed against, and it is intentionally allowed to differ from the
// LeadNet dashboard's pin — same Stripe account, independently upgradable apps.
const API_VERSION = '2026-08-26.dahlia'

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
  cached = new Stripe(key, { apiVersion: API_VERSION })
  return cached
}

export interface HoldParams {
  bidId: number
  zoneId: string
  zoneName: string
  amountCents: number
  depositCents: number
  sponsorName: string
  sponsorEmail: string
}

/**
 * Authorises the deposit. Returns the client secret the browser needs to
 * confirm the card.
 *
 * `capture_method: 'manual'` is the entire trick. The bid id goes into metadata
 * because the webhook has to map an authorisation back to a bid, and metadata
 * is the only field that survives the round trip intact.
 */
export async function createDepositHold(
  params: HoldParams,
): Promise<{ paymentIntentId: string; clientSecret: string }> {
  const stripe = getStripe()

  const intent = await stripe.paymentIntents.create(
    {
      amount: params.depositCents,
      currency: CURRENCY,
      capture_method: 'manual',
      automatic_payment_methods: { enabled: true },
      receipt_email: params.sponsorEmail,
      description: `Bid deposit — ${params.zoneName} — ${params.sponsorName}`,
      statement_descriptor_suffix: 'BRANDMYASS',
      metadata: {
        bid_id: String(params.bidId),
        zone_id: params.zoneId,
        zone_name: params.zoneName,
        bid_amount_cents: String(params.amountCents),
        sponsor_name: params.sponsorName,
      },
    },
    // Stripe deduplicates on this key, so a double-submitted bid form cannot
    // place two holds on the same card for the same bid.
    { idempotencyKey: `bid-hold-${params.bidId}` },
  )

  if (!intent.client_secret) throw new Error('Stripe returned a PaymentIntent with no client secret')
  return { paymentIntentId: intent.id, clientSecret: intent.client_secret }
}

/**
 * Releases a hold. Used when a bidder is outbid, or when their authorisation
 * lands too late to win.
 *
 * Cancelling an intent that is already cancelled throws, and Stripe redelivers
 * webhooks, so that specific error is swallowed — a released hold staying
 * released is the outcome we wanted anyway.
 */
export async function releaseHold(paymentIntentId: string): Promise<void> {
  const stripe = getStripe()
  try {
    await stripe.paymentIntents.cancel(paymentIntentId)
  } catch (err) {
    const e = err as Stripe.errors.StripeError
    if (e?.code === 'payment_intent_unexpected_state') return
    throw err
  }
}

/** Takes the deposit from a winner. */
export async function captureHold(paymentIntentId: string): Promise<void> {
  const stripe = getStripe()
  try {
    await stripe.paymentIntents.capture(paymentIntentId)
  } catch (err) {
    const e = err as Stripe.errors.StripeError
    // Already captured — a redelivered webhook or a re-run settle job.
    if (e?.code === 'payment_intent_unexpected_state') return
    throw err
  }
}

export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET')
  return getStripe().webhooks.constructEvent(rawBody, signature, secret)
}
