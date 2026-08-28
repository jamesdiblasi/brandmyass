import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import type { ActivationResult } from './auction'
import { APP_TAG } from './stripe'
import { bidIdFromIntent, handleStripeEvent, type BidPaymentRecord, type WebhookDeps } from './webhook'

/**
 * This is the code that decides whether a stranger's money is kept or given
 * back, so it is tested against every ordering Stripe can actually produce
 * rather than against the happy path.
 *
 * Nothing here touches Stripe or Postgres. The handler takes its world as an
 * interface precisely so these can be plain function calls.
 */

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

function intent(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
  return {
    id: 'pi_bid7',
    object: 'payment_intent',
    amount: 50_000,
    amount_received: 50_000,
    currency: 'aud',
    status: 'succeeded',
    metadata: { app: APP_TAG, bid_id: '7', zone_id: 'left_cheek' },
    ...overrides,
  } as unknown as Stripe.PaymentIntent
}

function event(type: string, object: unknown, id = 'evt_1'): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event
}

function activation(overrides: Partial<ActivationResult> = {}): ActivationResult {
  return { outcome: 'activated', displacedBidId: null, extended: false, newClosesAt: null, ...overrides }
}

const BID: BidPaymentRecord = { id: 7, amountCents: 50_000, status: 'pending', paymentIntentId: 'pi_bid7' }

/** A deps object where every call is a spy and the defaults are the happy path. */
function mockDeps(overrides: Partial<WebhookDeps> = {}) {
  // One claim per event id, so a second delivery of the same event is a
  // duplicate exactly as the database would report it.
  const claimed = new Set<string>()
  const finished = new Set<string>()

  const deps = {
    claimEvent: vi.fn(async (e: { id: string }) => {
      if (finished.has(e.id)) return 'duplicate' as const
      if (claimed.has(e.id)) return 'duplicate' as const
      claimed.add(e.id)
      return 'claimed' as const
    }),
    completeEvent: vi.fn(async (id: string) => {
      finished.add(id)
    }),
    releaseEvent: vi.fn(async (id: string) => {
      claimed.delete(id)
    }),
    loadBid: vi.fn(async () => ({ ...BID })),
    recordPayment: vi.fn(async () => {}),
    activateBid: vi.fn(async () => activation()),
    cancelBid: vi.fn(async () => {}),
    flagRefundDue: vi.fn(async () => {}),
    log: vi.fn(),
    ...overrides,
  } as unknown as WebhookDeps & Record<string, ReturnType<typeof vi.fn>>

  return deps
}

beforeEach(() => vi.clearAllMocks())

/* -------------------------------------------------------------------------- */

describe('bidIdFromIntent', () => {
  it('accepts a PaymentIntent this app stamped', () => {
    expect(bidIdFromIntent(intent())).toBe(7)
  })

  it('ignores a payment belonging to another app on the same Stripe account', () => {
    // The dashboard shares this Stripe account, and a Stripe webhook endpoint
    // receives every event of its subscribed types account-wide. An invoice
    // payment for the dashboard must be invisible to this handler.
    const dashboardInvoice = intent({ metadata: { site_id: 'abc', owner_id: '99' } as Stripe.Metadata })
    expect(bidIdFromIntent(dashboardInvoice)).toBeNull()
  })

  it('is not satisfied by a bid_id alone', () => {
    expect(bidIdFromIntent(intent({ metadata: { bid_id: '7' } as Stripe.Metadata }))).toBeNull()
  })

  it('refuses ids that are not plainly a positive integer', () => {
    for (const bid_id of ['', '0', '-1', '1.5', 'seven', '1e3', ' 7']) {
      expect(bidIdFromIntent(intent({ metadata: { app: APP_TAG, bid_id } as Stripe.Metadata }))).toBeNull()
    }
  })
})

describe('payment_intent.succeeded — promotion', () => {
  it('promotes the bid and takes nothing back', async () => {
    const deps = mockDeps()
    const out = await handleStripeEvent(event('payment_intent.succeeded', intent()), deps)

    expect(out).toEqual({ status: 'activated', bidId: 7 })
    expect(deps.recordPayment).toHaveBeenCalledWith(7, 'pi_bid7')
    expect(deps.activateBid).toHaveBeenCalledWith(7)
    expect(deps.flagRefundDue).not.toHaveBeenCalled()
    expect(deps.completeEvent).toHaveBeenCalledWith('evt_1')
  })

  it('does not refund the sponsor it knocked off', async () => {
    // The whole money model in one assertion: being outbid buys you the time
    // your logo was up, and that is what you paid for.
    const deps = mockDeps({
      activateBid: vi.fn(async () => activation({ displacedBidId: 4 })),
    })
    const out = await handleStripeEvent(event('payment_intent.succeeded', intent()), deps)

    expect(out).toEqual({ status: 'activated', bidId: 7 })
    expect(deps.flagRefundDue).not.toHaveBeenCalled()
  })

  it("ignores another application's payment without touching the database", async () => {
    const deps = mockDeps()
    const foreign = intent({ metadata: { invoice: 'in_123' } as Stripe.Metadata })
    const out = await handleStripeEvent(event('payment_intent.succeeded', foreign), deps)

    expect(out.status).toBe('ignored')
    expect(deps.loadBid).not.toHaveBeenCalled()
    expect(deps.activateBid).not.toHaveBeenCalled()
    expect(deps.flagRefundDue).not.toHaveBeenCalled()
  })
})

describe('payment_intent.succeeded — money never moves on its own', () => {
  it('flags, but does not refund, a payment that cleared after somebody had gone higher', async () => {
    // Refunds are a human decision here. The handler's whole job in this case
    // is to make it findable — an unflagged one is a refund nobody learns is
    // owed.
    const deps = mockDeps({ activateBid: vi.fn(async () => activation({ outcome: 'too_late' })) })
    const out = await handleStripeEvent(event('payment_intent.succeeded', intent()), deps)

    expect(out).toEqual({ status: 'refund_due', bidId: 7 })
    expect(deps.flagRefundDue).toHaveBeenCalledWith(7)
  })

  it('never moves money by itself on any path', async () => {
    // A standing guard: nothing in these deps can issue a refund, so if a
    // future change reintroduces one this suite stops compiling rather than
    // quietly paying people back.
    const deps = mockDeps()
    expect('refund' in deps).toBe(false)
  })

  it('keeps the money of a bid that was displayed and later outbid', async () => {
    const deps = mockDeps({ activateBid: vi.fn(async () => activation({ outcome: 'already_displayed' })) })
    const out = await handleStripeEvent(event('payment_intent.succeeded', intent()), deps)

    expect(out).toEqual({ status: 'kept', bidId: 7 })
    expect(deps.flagRefundDue).not.toHaveBeenCalled()
  })

  it('fails the delivery when the flag cannot be written, so Stripe retries', async () => {
    // A flag that silently fails to save is worse than no flag: the money is
    // taken, the logo never went on, and nothing anywhere records that anyone
    // is owed. Better to bounce the webhook and get another attempt.
    const deps = mockDeps({
      activateBid: vi.fn(async () => activation({ outcome: 'too_late' })),
      flagRefundDue: vi.fn(async () => {
        throw new Error('database is having a day')
      }),
    })

    await expect(handleStripeEvent(event('payment_intent.succeeded', intent()), deps)).rejects.toThrow()
    expect(deps.completeEvent).not.toHaveBeenCalled()
    expect(deps.releaseEvent).toHaveBeenCalledWith('evt_1')
  })
})

describe('payment_intent.succeeded — refusing what does not add up', () => {
  it("will not promote a bid using a payment that is not that bid's", async () => {
    const deps = mockDeps({
      loadBid: vi.fn(async () => ({ ...BID, paymentIntentId: 'pi_somethingelse' })),
    })
    const out = await handleStripeEvent(event('payment_intent.succeeded', intent()), deps)

    expect(out.status).toBe('mismatch')
    expect(deps.activateBid).not.toHaveBeenCalled()
    // Nothing is refunded on a state we do not understand either — a wrong
    // refund on a shared Stripe account is unrecoverable.
    expect(deps.flagRefundDue).not.toHaveBeenCalled()
  })

  it('will not let a cheaper payment buy a more expensive placement', async () => {
    const deps = mockDeps()
    const short = intent({ amount: 10_000, amount_received: 10_000 })
    const out = await handleStripeEvent(event('payment_intent.succeeded', short), deps)

    expect(out.status).toBe('mismatch')
    expect(deps.activateBid).not.toHaveBeenCalled()
    expect(deps.flagRefundDue).not.toHaveBeenCalled()
  })

  it('does not refund on a bid id that does not exist', async () => {
    const deps = mockDeps({ loadBid: vi.fn(async () => null) })
    const out = await handleStripeEvent(event('payment_intent.succeeded', intent()), deps)

    expect(out.status).toBe('mismatch')
    expect(deps.flagRefundDue).not.toHaveBeenCalled()
  })

  it('backfills the intent id on a bid that has none recorded', async () => {
    const deps = mockDeps({ loadBid: vi.fn(async () => ({ ...BID, paymentIntentId: null })) })
    const out = await handleStripeEvent(event('payment_intent.succeeded', intent()), deps)

    expect(out).toEqual({ status: 'activated', bidId: 7 })
    expect(deps.recordPayment).toHaveBeenCalledWith(7, 'pi_bid7')
  })
})

describe('idempotency', () => {
  it('does nothing at all on a redelivered event', async () => {
    const deps = mockDeps()
    const e = event('payment_intent.succeeded', intent(), 'evt_dup')

    const first = await handleStripeEvent(e, deps)
    const second = await handleStripeEvent(e, deps)

    expect(first).toEqual({ status: 'activated', bidId: 7 })
    expect(second).toEqual({ status: 'duplicate' })
    expect(deps.activateBid).toHaveBeenCalledTimes(1)
    expect(deps.recordPayment).toHaveBeenCalledTimes(1)
    expect(deps.flagRefundDue).not.toHaveBeenCalled()
  })

  it('does not flag twice when a flagged event is redelivered', async () => {
    // One flag per payment. A redelivery must not put the same person into the
    // refund queue a second time and invite paying them twice by hand.
    const deps = mockDeps({ activateBid: vi.fn(async () => activation({ outcome: 'too_late' })) })
    const e = event('payment_intent.succeeded', intent(), 'evt_refund')

    await handleStripeEvent(e, deps)
    const second = await handleStripeEvent(e, deps)

    expect(second).toEqual({ status: 'duplicate' })
    expect(deps.flagRefundDue).toHaveBeenCalledTimes(1)
  })

  it('re-runs the work when a delivery released its claim after failing', async () => {
    // The self-healing case: the first attempt's flag write failed, the claim
    // was released, and Stripe's retry gets a real second go rather than being
    // told it is a duplicate.
    let failing = true
    const deps = mockDeps({
      activateBid: vi.fn(async () => activation({ outcome: 'too_late' })),
      flagRefundDue: vi.fn(async () => {
        if (failing) throw new Error('transient')
      }),
    })
    const e = event('payment_intent.succeeded', intent(), 'evt_retry')

    await expect(handleStripeEvent(e, deps)).rejects.toThrow()
    failing = false
    const second = await handleStripeEvent(e, deps)

    expect(second).toEqual({ status: 'refund_due', bidId: 7 })
    expect(deps.flagRefundDue).toHaveBeenCalledTimes(2)
    expect(deps.completeEvent).toHaveBeenCalledTimes(1)
  })
})

describe('failed and cancelled payments', () => {
  it('leaves the bid alone when one card attempt is declined', async () => {
    // payment_failed is not terminal: the Payment Element invites the bidder to
    // try another card on the same intent. Cancelling the bid here left the
    // succeeded event that followed with nothing to promote — charged, and no
    // placement.
    const deps = mockDeps()
    const out = await handleStripeEvent(
      event('payment_intent.payment_failed', intent({ status: 'requires_payment_method' })),
      deps,
    )

    expect(out.status).toBe('ignored')
    expect(deps.cancelBid).not.toHaveBeenCalled()
  })

  it('cancels the bid when the intent itself is cancelled', async () => {
    const deps = mockDeps()
    const out = await handleStripeEvent(
      event('payment_intent.canceled', intent({ status: 'canceled' })),
      deps,
    )

    expect(out).toEqual({ status: 'cancelled', bidId: 7 })
    expect(deps.cancelBid).toHaveBeenCalledWith(7)
  })

  it('ignores a cancelled payment that was never ours', async () => {
    const deps = mockDeps()
    const out = await handleStripeEvent(
      event('payment_intent.canceled', intent({ metadata: {} as Stripe.Metadata })),
      deps,
    )

    expect(out.status).toBe('ignored')
    expect(deps.cancelBid).not.toHaveBeenCalled()
  })

  it('ignores event types it has no business acting on', async () => {
    const deps = mockDeps()
    const out = await handleStripeEvent(event('charge.refunded', {}), deps)

    expect(out.status).toBe('ignored')
    expect(deps.activateBid).not.toHaveBeenCalled()
    expect(deps.cancelBid).not.toHaveBeenCalled()
    expect(deps.completeEvent).toHaveBeenCalledWith('evt_1')
  })
})
