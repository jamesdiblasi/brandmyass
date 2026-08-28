/**
 * The manual refund queue.
 *
 *   npm run auction:refunds                  list what is owed
 *   npm run auction:refunds -- --mark 42     record that bid 42 was refunded
 *
 * Refunds are not automatic: the webhook flags a payment that cleared after
 * somebody had already gone higher — a logo that never went on at all — and
 * leaves the decision to a human. This is the only place that queue is
 * visible, which makes it the difference between "I'll refund manually" and
 * nobody ever finding out one was owed.
 *
 * The money itself moves in the Stripe Dashboard: open the PaymentIntent this
 * lists and press Refund. Doing it there rather than here is deliberate — it
 * means NO credential with refund permission exists in this codebase or on the
 * server, only in a browser session with your own Stripe login. This script
 * just keeps the books: `--mark` stamps refunded_at so the row leaves the
 * queue and cannot be paid twice.
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

  const markFlag = process.argv.indexOf('--mark')
  const markId = markFlag === -1 ? null : Number(process.argv[markFlag + 1])
  if (markFlag !== -1 && !Number.isSafeInteger(markId)) {
    console.error('--mark needs a bid id, e.g. `npm run auction:refunds -- --mark 42`')
    process.exit(1)
  }

  const rows = await query<Row>(`
    select id, zone_id, amount_cents, sponsor_name, sponsor_email,
           stripe_payment_intent_id, refund_due_at
    from bids
    where refund_due_at is not null and refunded_at is null
    order by refund_due_at
  `)

  if (markId == null) {
    if (rows.length === 0) {
      console.log('· nothing owed')
    } else {
      console.log(`${rows.length} payment(s) owed a refund — none of this is automatic:\n`)
      for (const r of rows) {
        console.log(`  bid ${r.id}  ${formatMoney(r.amount_cents)}  ${getZone(r.zone_id)?.name ?? r.zone_id}`)
        console.log(`    ${r.sponsor_name} <${r.sponsor_email}>`)
        console.log(`    ${r.stripe_payment_intent_id ?? 'NO PAYMENT INTENT — check Stripe by hand'}`)
        console.log(`    flagged ${r.refund_due_at.toISOString()}`)
        console.log('    refund it in the Stripe Dashboard (open the intent above, press Refund), then:')
        console.log(`      npm run auction:refunds -- --mark ${r.id}\n`)
      }
    }
    await closePool()
    return
  }

  const row = rows.find((r) => r.id === markId)
  if (!row) {
    console.error(`bid ${markId} is not in the refund queue. Nothing done.`)
    process.exit(1)
  }

  // Recording only — the refund itself happened (or should have) in the Stripe
  // Dashboard. Marking first and refunding never is the failure this cannot
  // protect against, which is why the prompt above tells you the order.
  await query('update bids set refunded_at = now(), updated_at = now() where id = $1', [markId])
  console.log(
    `✓ recorded: bid ${markId} (${formatMoney(row.amount_cents)}, ${row.sponsor_email}) marked refunded`,
  )

  await closePool()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
