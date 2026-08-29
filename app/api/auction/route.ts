import { NextResponse } from 'next/server'
import { getAuctionState, getRecentBids, getSponsorHistory } from '@/lib/auction'

// The board is live. Any caching here shows people a stale top bid and invites
// them to place a bid that is guaranteed to be rejected.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const [state, recent, history] = await Promise.all([getAuctionState(), getRecentBids(12), getSponsorHistory()])
    return NextResponse.json(
      {
        ...state,
        history,
        recent: recent.map((r) => ({
          zoneId: r.zone_id,
          amountCents: r.amount_cents,
          sponsorName: r.sponsor_name,
          status: r.status,
          at: r.created_at,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('[auction] state read failed', err)
    return NextResponse.json({ error: 'The auction is having a moment. Try again shortly.' }, { status: 500 })
  }
}
