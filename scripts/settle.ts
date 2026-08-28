/**
 * Closes out every zone whose clock has expired and captures the winners'
 * deposits. Safe to run on a schedule — settlement is idempotent per zone.
 *
 *   npm run auction:settle
 *
 * Run it at least daily. Stripe expires an uncaptured authorisation after
 * roughly seven days, so a campaign longer than that needs this job (or a
 * re-authorisation flow) to avoid winners' holds lapsing.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config()

async function main(): Promise<void> {
  const { settleClosedZones } = await import('../lib/auction')
  const { captureHold } = await import('../lib/stripe')
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
    if (!w.paymentIntentId) {
      console.warn(`! ${zoneName}: winner has no PaymentIntent — settle by hand (bid ${w.bidId})`)
      continue
    }
    try {
      await captureHold(w.paymentIntentId)
      await query('update bids set hold_captured_at = now(), updated_at = now() where id = $1', [w.bidId])
      console.log(
        `✓ ${zoneName} → ${w.sponsorName} at ${formatMoney(w.amountCents)} ` +
          `(deposit ${formatMoney(w.depositCents)} captured; balance ${formatMoney(w.amountCents - w.depositCents)} to invoice)`,
      )
    } catch (err) {
      console.error(`✗ ${zoneName}: capture failed for bid ${w.bidId}`, err)
    }
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
