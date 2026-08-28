import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** "Do this to my ass too" — the upsell list. */
export async function POST(req: Request) {
  let body: { email?: unknown; note?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That is not an email address.' }, { status: 400 })
  }

  try {
    await query(
      `insert into waitlist (email, note) values ($1, $2)
       on conflict (email) do update set note = coalesce(excluded.note, waitlist.note)`,
      [email, note],
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[waitlist] insert failed', err)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
}
