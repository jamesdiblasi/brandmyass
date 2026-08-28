/**
 * Seeds the auction window and one zone_state row per zone in lib/zones.ts.
 *
 * Re-runnable. Existing zones have their reserve refreshed from code (so a
 * copywriting pass that changes a price takes effect) but their clock and bid
 * history are left alone — this must never quietly wipe a live auction.
 *
 *   BMA_CAMPAIGN_DAYS   length of the campaign, default 21
 *   BMA_GOAL_CENTS      the "goal" the progress bar fills toward, default $2,500
 */
import { config } from 'dotenv'
import { Client } from 'pg'
import { ZONES } from '../lib/zones'

config({ path: '.env.local' })
config()

const DAYS = Number(process.env.BMA_CAMPAIGN_DAYS || 21)
const GOAL_CENTS = Number(process.env.BMA_GOAL_CENTS || 250_000)

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }
  if (!Number.isFinite(DAYS) || DAYS <= 0) throw new Error('BMA_CAMPAIGN_DAYS must be a positive number')

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } })
  await client.connect()

  try {
    await client.query('BEGIN')

    const opens = new Date()
    const closes = new Date(opens.getTime() + DAYS * 24 * 60 * 60 * 1000)

    await client.query(
      `insert into auction (id, opens_at, closes_at, goal_cents)
       values (1, $1, $2, $3)
       on conflict (id) do nothing`,
      [opens, closes, GOAL_CENTS],
    )
    const { rows: auctionRows } = await client.query<{ closes_at: Date }>(
      'select closes_at from auction where id = 1',
    )
    const auctionCloses = auctionRows[0].closes_at

    for (const zone of ZONES) {
      await client.query(
        `insert into zone_state (zone_id, reserve_cents, closes_at)
         values ($1, $2, $3)
         on conflict (zone_id) do update
           set reserve_cents = excluded.reserve_cents,
               updated_at    = now()`,
        [zone.id, zone.reserveCents, auctionCloses],
      )
    }

    await client.query('COMMIT')
    console.log(`✓ auction seeded — ${ZONES.length} zones, closes ${auctionCloses.toISOString()}`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
