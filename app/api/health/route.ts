import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { isBlobConfigured } from '@/lib/blob'

export const dynamic = 'force-dynamic'

/**
 * Which of its credentials the running process actually holds, as BOOLEANS.
 *
 * This exists because the site's operator cannot see inside the App Service
 * from the outside, and every misconfiguration here fails silently by design:
 * no DATABASE_URL falls back to the offline board, no STRIPE_SECRET_KEY turns
 * bids into a clean 502, and a missing webhook secret just means no bid is
 * ever promoted. The deploy workflow's smoke test prints this, which turns
 * "it deployed" into "it deployed and is actually wired".
 *
 * Never values, never prefixes beyond live/test, never lengths. The mode is
 * reported because accidentally running live keys on a test webhook (or vice
 * versa) is a real failure this can catch.
 */
export async function GET() {
  let db = false
  try {
    await query('select 1')
    db = true
  } catch {
    db = false
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY || ''
  const stripeMode = stripeKey.includes('_live_') ? 'live' : stripeKey.includes('_test_') ? 'test' : null

  return NextResponse.json(
    {
      db,
      stripeSecretKey: Boolean(stripeKey),
      stripeMode,
      stripeWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      logoStorage: isBlobConfigured(),
      // Baked in at build time, so its presence here proves the BUILD had it,
      // not the runtime environment.
      publishableKeyInBundle: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
