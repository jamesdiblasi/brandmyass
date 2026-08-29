import type { PoolClient } from 'pg'
import { query, queryOne, transaction } from './db'
import { ZONES, ZONES_BY_ID } from './zones'
import { ANTI_SNIPE_EXTENSION_MS, ANTI_SNIPE_WINDOW_MS, MIN_INCREMENT_CENTS } from './config'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface StandingBid {
  id: number
  amountCents: number
  sponsorName: string
  sponsorUrl: string | null
  logoUrl: string | null
  placedAt: string
}

export interface ZoneAuctionState {
  zoneId: string
  reserveCents: number
  /** What the next bid must be at least. */
  minimumBidCents: number
  closesAt: string
  extensions: number
  settled: boolean
  closed: boolean
  bidCount: number
  topBid: StandingBid | null
}

export interface AuctionState {
  opensAt: string
  closesAt: string
  goalCents: number
  raisedCents: number
  settledAt: string | null
  open: boolean
  zones: ZoneAuctionState[]
  serverNow: string
}

export class BidError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'zone_unknown'
      | 'auction_closed'
      | 'zone_closed'
      | 'too_low'
      | 'invalid'
      | 'outbid_already',
    readonly minimumBidCents?: number,
  ) {
    super(message)
    this.name = 'BidError'
  }
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

interface ZoneRow {
  zone_id: string
  reserve_cents: number
  closes_at: Date
  extensions: number
  settled: boolean
  bid_count: number
  bid_id: number | null
  amount_cents: number | null
  sponsor_name: string | null
  sponsor_url: string | null
  logo_url: string | null
  bid_at: Date | null
}

/**
 * One round trip for the whole board. The front end polls this, so it is a
 * single query rather than a fan-out per zone.
 *
 * "Standing bid" means status in ('active','won') — a won bid must keep showing
 * on a closed zone, and by construction there is only ever one of either per
 * zone.
 */
export async function getAuctionState(): Promise<AuctionState> {
  const auction = await queryOne<{
    opens_at: Date
    closes_at: Date
    goal_cents: number
    settled_at: Date | null
  }>('select opens_at, closes_at, goal_cents, settled_at from auction where id = 1')

  if (!auction) {
    throw new Error('Auction row is missing. Run `npm run db:seed`.')
  }

  const rows = await query<ZoneRow>(`
    select
      zs.zone_id,
      zs.reserve_cents,
      zs.closes_at,
      zs.extensions,
      zs.settled,
      coalesce(bc.n, 0)      as bid_count,
      b.id                   as bid_id,
      b.amount_cents,
      b.sponsor_name,
      b.sponsor_url,
      b.logo_url,
      b.created_at           as bid_at
    from zone_state zs
    left join bids b
      on b.zone_id = zs.zone_id and b.status in ('active', 'won')
    left join lateral (
      select count(*)::int as n
      from bids c
      where c.zone_id = zs.zone_id
        and c.status in ('active', 'outbid', 'won', 'lost')
    ) bc on true
  `)

  const byId = new Map(rows.map((r) => [r.zone_id, r]))
  const now = Date.now()

  // Iterate ZONES, not the rows, so the board renders in the designed order and
  // a zone added in code but not yet seeded shows as unavailable instead of
  // vanishing.
  const zones: ZoneAuctionState[] = ZONES.map((zone) => {
    const row = byId.get(zone.id)
    if (!row) {
      return {
        zoneId: zone.id,
        reserveCents: zone.reserveCents,
        minimumBidCents: zone.reserveCents,
        closesAt: auction.closes_at.toISOString(),
        extensions: 0,
        settled: false,
        closed: true,
        bidCount: 0,
        topBid: null,
      }
    }

    const topBid: StandingBid | null =
      row.bid_id != null
        ? {
            id: row.bid_id,
            amountCents: row.amount_cents as number,
            sponsorName: row.sponsor_name as string,
            sponsorUrl: row.sponsor_url,
            logoUrl: row.logo_url,
            placedAt: (row.bid_at as Date).toISOString(),
          }
        : null

    return {
      zoneId: zone.id,
      reserveCents: row.reserve_cents,
      minimumBidCents: topBid ? topBid.amountCents + MIN_INCREMENT_CENTS : row.reserve_cents,
      closesAt: row.closes_at.toISOString(),
      extensions: row.extensions,
      settled: row.settled,
      closed: row.closes_at.getTime() <= now,
      bidCount: row.bid_count,
      topBid,
    }
  })

  const raisedCents = zones.reduce((sum, z) => sum + (z.topBid?.amountCents ?? 0), 0)

  return {
    opensAt: auction.opens_at.toISOString(),
    closesAt: auction.closes_at.toISOString(),
    goalCents: auction.goal_cents,
    raisedCents,
    settledAt: auction.settled_at?.toISOString() ?? null,
    open: auction.opens_at.getTime() <= now && zones.some((z) => !z.closed),
    zones,
    serverNow: new Date(now).toISOString(),
  }
}

/* -------------------------------------------------------------------------- */
/*  Writes                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Locks the zone row and returns the current floor. Callers MUST already be in
 * a transaction — the lock is what serialises two people bidding on the same
 * cheek in the same instant, and it evaporates the moment the transaction ends.
 */
async function lockZoneAndReadFloor(
  client: PoolClient,
  zoneId: string,
): Promise<{ minimumBidCents: number; closesAt: Date; topBidId: number | null; topAmount: number }> {
  const zoneRes = await client.query<{ reserve_cents: number; closes_at: Date }>(
    'select reserve_cents, closes_at from zone_state where zone_id = $1 for update',
    [zoneId],
  )
  if (zoneRes.rows.length === 0) throw new BidError('No such zone.', 'zone_unknown')
  const zone = zoneRes.rows[0]

  const topRes = await client.query<{ id: number; amount_cents: number }>(
    `select id, amount_cents from bids
     where zone_id = $1 and status in ('active','won')
     order by amount_cents desc limit 1`,
    [zoneId],
  )
  const top = topRes.rows[0]

  return {
    minimumBidCents: top ? top.amount_cents + MIN_INCREMENT_CENTS : zone.reserve_cents,
    closesAt: zone.closes_at,
    topBidId: top?.id ?? null,
    topAmount: top?.amount_cents ?? 0,
  }
}

export interface CreateBidInput {
  zoneId: string
  amountCents: number
  sponsorName: string
  sponsorEmail: string
  sponsorUrl?: string | null
  logoUrl?: string | null
}

export interface CreatedBid {
  id: number
  zoneId: string
  amountCents: number
}

/**
 * Records a bid in `pending` and returns it, ready to be charged.
 *
 * A pending bid deliberately does NOT become the standing bid. It is only a
 * claim to have started paying. Promotion happens in `activateBid`, once
 * Stripe confirms the money actually moved — otherwise anybody could take a
 * placement off the market for free by typing a big number.
 */
export async function createBid(input: CreateBidInput): Promise<CreatedBid> {
  const zone = ZONES_BY_ID.get(input.zoneId)
  if (!zone) throw new BidError('No such zone.', 'zone_unknown')

  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new BidError('That is not an amount of money.', 'invalid')
  }
  const name = input.sponsorName.trim()
  const email = input.sponsorEmail.trim().toLowerCase()
  if (name.length < 1 || name.length > 80) throw new BidError('Sponsor name is required.', 'invalid')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BidError('A real email address, please.', 'invalid')

  // The link is rendered as an href to every visitor, so only web URLs get in.
  // A javascript: or data: scheme is not a typo to fix quietly — reject loudly.
  const sponsorUrl = input.sponsorUrl?.trim() || null
  if (sponsorUrl) {
    let ok = false
    try {
      const parsed = new URL(sponsorUrl)
      ok = parsed.protocol === 'https:' || parsed.protocol === 'http:'
    } catch {
      ok = false
    }
    if (!ok) throw new BidError('The link has to be a normal https:// address.', 'invalid')
  }

  return transaction(async (client) => {
    const floor = await lockZoneAndReadFloor(client, input.zoneId)

    if (floor.closesAt.getTime() <= Date.now()) {
      throw new BidError('This one has already closed.', 'zone_closed')
    }
    if (input.amountCents < floor.minimumBidCents) {
      throw new BidError('Somebody has already bid that much or more.', 'too_low', floor.minimumBidCents)
    }

    const res = await client.query<{ id: number }>(
      `insert into bids (zone_id, amount_cents, sponsor_name, sponsor_email, sponsor_url, logo_url, status)
       values ($1, $2, $3, $4, $5, $6, 'pending')
       returning id`,
      [
        input.zoneId,
        input.amountCents,
        name,
        email,
        sponsorUrl,
        input.logoUrl?.trim() || null,
      ],
    )

    return { id: res.rows[0].id, zoneId: input.zoneId, amountCents: input.amountCents }
  })
}

export interface ActivationResult {
  /**
   * What happened, in the only terms the caller needs in order to decide about
   * money:
   *
   *   activated         this bid is now (or already was) the standing bid.
   *   already_displayed this bid went on and has since been outbid. It keeps
   *                     its money — it bought the time it had.
   *   too_late          the money moved but the logo never went on. This is the
   *                     ONLY outcome that refunds.
   *   unknown_bid       no such bid. Nothing is assumed and nothing is moved.
   */
  outcome: 'activated' | 'already_displayed' | 'too_late' | 'unknown_bid'
  /** The displaced bid is NOT refunded — it paid for the time its logo spent on
   *  the ass, and it had that time. Kept here only so the caller can log who
   *  was knocked off. */
  displacedBidId: number | null
  /** True when this bid landed inside the anti-snipe window and pushed the clock. */
  extended: boolean
  newClosesAt: string | null
}

/**
 * Promotes a paid bid to the standing bid, demoting whoever held it.
 *
 * Called from the Stripe webhook, never from a request handler, because only
 * Stripe can tell us the money moved. Re-validates the amount under a row lock:
 * between the bid being created and the card clearing, somebody else may have
 * gone higher, and in that case this bid loses rather than overwriting a
 * legitimately higher one — and because it has already been charged and its
 * logo never went on, the caller refunds it.
 *
 * Stripe redelivers webhooks, so this is idempotent — a bid that is already
 * active reports success and releases nothing a second time.
 */
export async function activateBid(bidId: number): Promise<ActivationResult> {
  return transaction(async (client) => {
    const bidRes = await client.query<{
      id: number
      zone_id: string
      amount_cents: number
      status: string
    }>('select id, zone_id, amount_cents, status from bids where id = $1 for update', [bidId])

    const bid = bidRes.rows[0]
    if (!bid) return { outcome: 'unknown_bid', displacedBidId: null, extended: false, newClosesAt: null }

    // Replayed webhook for a bid we already promoted. `won` counts: it was the
    // standing bid when its zone closed, so it was displayed and stays paid.
    if (bid.status === 'active' || bid.status === 'won') {
      return { outcome: 'activated', displacedBidId: null, extended: false, newClosesAt: null }
    }

    // Displayed, then beaten. Keeps its money — that is the whole model.
    if (bid.status === 'outbid') {
      return { outcome: 'already_displayed', displacedBidId: null, extended: false, newClosesAt: null }
    }

    // `lost` and `cancelled` both mean this logo never went on. Reporting
    // too_late for them is what makes the webhook's refund self-healing: if a
    // first refund attempt failed, a redelivery lands here and tries again, and
    // Stripe treats refunding an already-refunded charge as a no-op.
    //
    // `cancelled` reaching this point means money moved on a bid we had written
    // off. A cancelled intent cannot pay, so it should not be possible — but if
    // it ever is, the answer is the bidder's money back, not a placement they
    // stopped expecting and certainly not a silent keep.
    if (bid.status !== 'pending') {
      return { outcome: 'too_late', displacedBidId: null, extended: false, newClosesAt: null }
    }

    const floor = await lockZoneAndReadFloor(client, bid.zone_id)

    if (floor.closesAt.getTime() <= Date.now() || bid.amount_cents < floor.minimumBidCents) {
      await client.query(
        `update bids set status = 'lost', updated_at = now() where id = $1`,
        [bid.id],
      )
      return { outcome: 'too_late', displacedBidId: null, extended: false, newClosesAt: null }
    }

    // Demote the incumbent. Its money stays where it is — it bought the time
    // its logo spent on the ass, and that time happened.
    let displacedBidId: number | null = null
    if (floor.topBidId != null) {
      const prev = await client.query<{ id: number }>(
        `update bids set status = 'outbid', updated_at = now()
         where id = $1 and status = 'active'
         returning id`,
        [floor.topBidId],
      )
      displacedBidId = prev.rows[0]?.id ?? null
    }

    await client.query(`update bids set status = 'active', updated_at = now() where id = $1`, [bid.id])

    // Anti-snipe: a bid inside the window pushes the close out. Extensions set
    // the clock to now + EXTENSION rather than adding to it, so a flurry of
    // bids cannot compound the auction into next year.
    const msLeft = floor.closesAt.getTime() - Date.now()
    let extended = false
    let newClosesAt = floor.closesAt

    if (msLeft <= ANTI_SNIPE_WINDOW_MS) {
      newClosesAt = new Date(Date.now() + ANTI_SNIPE_EXTENSION_MS)
      await client.query(
        `update zone_state
         set closes_at = $2, extensions = extensions + 1, updated_at = now()
         where zone_id = $1`,
        [bid.zone_id, newClosesAt],
      )
      extended = true
    }

    return {
      outcome: 'activated',
      displacedBidId,
      extended,
      newClosesAt: newClosesAt.toISOString(),
    }
  })
}

/** Marks a pending bid abandoned — the card was declined or the sheet closed. */
export async function cancelBid(bidId: number): Promise<void> {
  await query(`update bids set status = 'cancelled', updated_at = now() where id = $1 and status = 'pending'`, [
    bidId,
  ])
}

export interface SettlementRow {
  bidId: number
  zoneId: string
  amountCents: number
  sponsorName: string
  sponsorEmail: string
}

/**
 * Closes every zone whose clock has run out, turning the standing bid into a
 * winner. Returns the winners so the caller can announce them.
 *
 * No money moves here. Every bid was charged when it was placed, so settlement
 * is purely a status change — which also means a settle job that fails to run
 * cannot cost anybody anything.
 *
 * Idempotent via `zone_state.settled`, so the cron can run as often as it likes.
 */
export async function settleClosedZones(): Promise<SettlementRow[]> {
  return transaction(async (client) => {
    const due = await client.query<{ zone_id: string }>(
      `select zone_id from zone_state
       where settled = false and closes_at <= now()
       for update`,
    )
    if (due.rows.length === 0) return []

    const winners: SettlementRow[] = []
    for (const { zone_id } of due.rows) {
      const res = await client.query<{
        id: number
        amount_cents: number
        sponsor_name: string
        sponsor_email: string
      }>(
        `update bids set status = 'won', updated_at = now()
         where zone_id = $1 and status = 'active'
         returning id, amount_cents, sponsor_name, sponsor_email`,
        [zone_id],
      )
      await client.query(`update zone_state set settled = true, updated_at = now() where zone_id = $1`, [zone_id])

      const w = res.rows[0]
      if (w) {
        winners.push({
          bidId: w.id,
          zoneId: zone_id,
          amountCents: w.amount_cents,
          sponsorName: w.sponsor_name,
          sponsorEmail: w.sponsor_email,
        })
      }
    }
    return winners
  })
}

export interface SponsorHistoryEntry {
  zoneId: string
  sponsorName: string
  sponsorUrl: string | null
  logoUrl: string | null
  amountCents: number
  /** active = wearing it now, outbid = wore it and lost it, won = kept it to the end */
  status: 'active' | 'outbid' | 'won'
  at: string
}

/**
 * Everyone who has ever actually owned a placement, newest first.
 *
 * 'lost' and 'cancelled' are excluded on purpose: a lost bid paid and was
 * refunded because its logo NEVER went on, and a cancelled one never paid.
 * Neither was ever an owner, even briefly. Outbid sponsors stay forever —
 * being displaced is the business model, not an erasure.
 */
export async function getSponsorHistory(limit = 100): Promise<SponsorHistoryEntry[]> {
  const rows = await query<{
    zone_id: string
    sponsor_name: string
    sponsor_url: string | null
    logo_url: string | null
    amount_cents: number
    status: string
    created_at: Date
  }>(
    `select zone_id, sponsor_name, sponsor_url, logo_url, amount_cents, status, created_at
     from bids
     where status in ('active', 'outbid', 'won')
     order by created_at desc
     limit $1`,
    [limit],
  )
  return rows.map((r) => ({
    zoneId: r.zone_id,
    sponsorName: r.sponsor_name,
    sponsorUrl: r.sponsor_url,
    logoUrl: r.logo_url,
    amountCents: r.amount_cents,
    status: r.status as 'active' | 'outbid' | 'won',
    at: r.created_at.toISOString(),
  }))
}
