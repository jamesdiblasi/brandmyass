/**
 * Closes out every zone whose clock has expired and records the winner.
 *
 *   npm run auction:settle
 *
 * No money moves: every bid was charged when it was placed. That makes this job
 * a bookkeeping step rather than a financial one, and means forgetting to run
 * it cannot cost anybody anything — it only delays the board saying "closed".
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config()

async function main(): Promise<void> {
  const { settleClosedZones } = await import('../lib/auction')
  const { formatMoney } = await import('../lib/money')
  const { query, closePool } = await import('../lib/db')
  const { getZone } = await import('../lib/zones')

  const winners = await settleClosedZones()

  if (winners.length === 0) {
    console.log('· nothing due to settle')
    await closePool()
    return
  }

  for (const w of winners) {
    const zoneName = getZone(w.zoneId)?.name ?? w.zoneId
    console.log(`✓ ${zoneName} → ${w.sponsorName} at ${formatMoney(w.amountCents)} — already paid`)
  }

  // Mark the whole campaign settled once no zone is left open.
  await query(
    `update auction set settled_at = now()
     where id = 1 and settled_at is null
       and not exists (select 1 from zone_state where settled = false)`,
  )

  await closePool()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
