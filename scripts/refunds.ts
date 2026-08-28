/**
 * The manual refund queue.
 *
 *   npm run auction:refunds                 list what is owed
 *   npm run auction:refunds -- --pay 42     refund bid 42 and mark it done
 *
 * Refunds are not automatic: the webhook flags a payment that cleared after
 * somebody had already gone higher — a logo that never went on at all — and
 * leaves the decision to a human. This is the only place that queue is
 * visible, which makes it the difference between "I'll refund manually" and
 * nobody ever finding out one was owed.
 *
 * Listing is the default and touches nothing. Paying takes an explicit bid id,
 * one at a time, so a stray run cannot empty the queue by accident.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config()

interface Row {
  id: number
  zone_id: string
  amount_cents: number
  sponsor_name: string
  sponsor_email: string
  stripe_payment_intent_id: string | null
  refund_due_at: Date
}

async function main(): Promise<void> {
  const { query, closePool } = await import('../lib/db')
  const { formatMoney } = await import('../lib/money')
  const { getZone } = await import('../lib/zones')

  const payFlag = process.argv.indexOf('--pay')
  const payId = payFlag === -1 ? null : Number(process.argv[payFlag + 1])
  if (payFlag !== -1 && !Number.isSafeInteger(payId)) {
    console.error('--pay needs a bid id, e.g. `npm run auction:refunds -- --pay 42`')
    process.exit(1)
  }

  const rows = await query<Row>(`
    select id, zone_id, amount_cents, sponsor_name, sponsor_email,
           stripe_payment_intent_id, refund_due_at
    from bids
    where refund_due_at is not null and refunded_at is null
    order by refund_due_at
  `)

  if (payId == null) {
    if (rows.length === 0) {
      console.log('· nothing owed')
    } else {
      console.log(`${rows.length} payment(s) owed a refund — none of this is automatic:\n`)
      for (const r of rows) {
        console.log(`  bid ${r.id}  ${formatMoney(r.amount_cents)}  ${getZone(r.zone_id)?.name ?? r.zone_id}`)
        console.log(`    ${r.sponsor_name} <${r.sponsor_email}>`)
        console.log(`    ${r.stripe_payment_intent_id ?? 'NO PAYMENT INTENT — check Stripe by hand'}`)
        console.log(`    flagged ${r.refund_due_at.toISOString()}`)
        console.log(`    refund:  npm run auction:refunds -- --pay ${r.id}\n`)
      }
    }
    await closePool()
    return
  }

  const row = rows.find((r) => r.id === payId)
  if (!row) {
    console.error(`bid ${payId} is not owed a refund. Nothing done.`)
    process.exit(1)
  }
  if (!row.stripe_payment_intent_id) {
    console.error(`bid ${payId} has no PaymentIntent on file. Refund it in the Stripe dashboard by hand.`)
    process.exit(1)
  }

  const { refundPayment } = await import('../lib/stripe')
  await refundPayment(row.stripe_payment_intent_id)
  // Stamped only after Stripe confirms, so a failure here leaves the row in the
  // queue to be tried again rather than silently marked done.
  await query('update bids set refunded_at = now(), updated_at = now() where id = $1', [payId])
  console.log(`✓ refunded ${formatMoney(row.amount_cents)} to ${row.sponsor_email} (bid ${payId})`)

  await closePool()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
