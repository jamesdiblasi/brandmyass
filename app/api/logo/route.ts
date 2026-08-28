import { NextResponse } from 'next/server'
import { LogoError, MAX_LOGO_BYTES, isBlobConfigured, uploadLogo } from '@/lib/blob'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Accepts a sponsor logo and returns its public URL.
 *
 * The upload happens BEFORE payment, which means this endpoint is reachable by
 * anyone. It is therefore deliberately narrow: one small file, magic-byte
 * checked, stored under a name we choose, with the content type we determined.
 * See lib/blob.ts for why each of those matters.
 */
export async function POST(req: Request) {
  if (!isBlobConfigured()) {
    return NextResponse.json(
      { error: 'Image upload is not configured on this deployment.' },
      { status: 503 },
    )
  }

  // Reject on the declared length before reading the body, so an oversized
  // upload costs us a header rather than 500 MB of memory.
  const declared = Number(req.headers.get('content-length') || 0)
  if (declared > MAX_LOGO_BYTES + 4096) {
    return NextResponse.json({ error: 'That image is over 2 MB.' }, { status: 413 })
  }

  let file: File | null = null
  try {
    const form = await req.formData()
    const candidate = form.get('file')
    if (candidate instanceof File) file = candidate
  } catch {
    return NextResponse.json({ error: 'Malformed upload.' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'No file was attached.' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())

  try {
    const url = await uploadLogo(buf)
    return NextResponse.json({ url })
  } catch (err) {
    if (err instanceof LogoError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[logo] upload failed', err)
    return NextResponse.json({ error: 'Could not store that image.' }, { status: 500 })
  }
}
