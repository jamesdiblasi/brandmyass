import { NextResponse } from 'next/server'
import { BidError, cancelBid, createBid } from '@/lib/auction'
import { createDepositHold } from '@/lib/stripe'
import { query } from '@/lib/db'
import { getZone } from '@/lib/zones'
import { formatMoney } from '@/lib/money'

export const dynamic = 'force-dynamic'

/**
 * Crude in-process throttle: 8 bid attempts per IP per minute.
 *
 * Not a security boundary — it resets on deploy and does not span instances —
 * but it is enough to stop a bored person hammering the form and creating a
 * thousand orphaned PaymentIntents. Real abuse protection belongs at the edge.
 */
const HITS = new Map<string, number[]>()
const LIMIT = 8
const WINDOW_MS = 60_000

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (HITS.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  hits.push(now)
  HITS.set(ip, hits)
  if (HITS.size > 5_000) HITS.clear() // crude bound on memory
  return hits.length > LIMIT
}

interface BidBody {
  zoneId?: unknown
  amountCents?: unknown
  sponsorName?: unknown
  sponsorEmail?: unknown
  sponsorUrl?: unknown
  logoUrl?: unknown
}

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Steady on. Give it a minute.' }, { status: 429 })
  }

  let body: BidBody
  try {
    body = (await req.json()) as BidBody
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  const zoneId = typeof body.zoneId === 'string' ? body.zoneId : ''
  const amountCents = typeof body.amountCents === 'number' ? body.amountCents : NaN
  const sponsorName = typeof body.sponsorName === 'string' ? body.sponsorName : ''
  const sponsorEmail = typeof body.sponsorEmail === 'string' ? body.sponsorEmail : ''
  const sponsorUrl = typeof body.sponsorUrl === 'string' ? body.sponsorUrl : null
  const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl : null

  const zone = getZone(zoneId)
  if (!zone) return NextResponse.json({ error: 'No such placement.' }, { status: 400 })

  let bid
  try {
    bid = await createBid({ zoneId, amountCents, sponsorName, sponsorEmail, sponsorUrl, logoUrl })
  } catch (err) {
    if (err instanceof BidError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          minimumBidCents: err.minimumBidCents,
          minimumBid: err.minimumBidCents ? formatMoney(err.minimumBidCents) : undefined,
        },
        { status: err.code === 'too_low' || err.code === 'zone_closed' ? 409 : 400 },
      )
    }
    console.error('[bids] create failed', err)
    return NextResponse.json({ error: 'Could not record that bid.' }, { status: 500 })
  }

  // The bid row exists but is worthless without a hold. If Stripe fails here we
  // cancel it immediately rather than leaving a pending row that a redelivered
  // webhook could later promote.
  try {
    const hold = await createDepositHold({
      bidId: bid.id,
      zoneId: zone.id,
      zoneName: zone.name,
      amountCents: bid.amountCents,
      depositCents: bid.depositCents,
      sponsorName: sponsorName.trim(),
      sponsorEmail: sponsorEmail.trim().toLowerCase(),
    })

    await query('update bids set stripe_payment_intent_id = $2, updated_at = now() where id = $1', [
      bid.id,
      hold.paymentIntentId,
    ])

    return NextResponse.json({
      bidId: bid.id,
      zoneId: zone.id,
      amountCents: bid.amountCents,
      depositCents: bid.depositCents,
      depositFormatted: formatMoney(bid.depositCents),
      clientSecret: hold.clientSecret,
    })
  } catch (err) {
    console.error('[bids] stripe hold failed', err)
    await cancelBid(bid.id).catch(() => {})
    return NextResponse.json({ error: 'The card hold could not be set up. Nothing was charged.' }, { status: 502 })
  }
}
