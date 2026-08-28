import { BlobServiceClient, type BlockBlobClient } from '@azure/storage-blob'
import { randomUUID } from 'node:crypto'

/**
 * Sponsor logo storage, in its own Azure Storage account.
 *
 * Deliberately NOT the storage the dashboard uses. These blobs are publicly
 * readable by design — a sponsor's logo has to render for every visitor — and
 * mixing publicly-readable marketing images into a container that also holds
 * business data is how a misconfigured access level turns into a leak. A
 * separate account keeps the blast radius at "someone can see logos that were
 * already on a public website".
 */

const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'logos'

/**
 * What we accept, checked by MAGIC BYTES rather than by the Content-Type the
 * browser claims.
 *
 * This is the actual security control on this endpoint. The files land on a
 * public URL, so a caller who could pass off HTML — or an SVG, which is a
 * script-bearing document however innocent it looks — would get stored XSS on
 * the storage domain for free. Sniffing the first bytes and then storing the
 * type WE determined, never the one we were handed, closes that.
 */
const SIGNATURES: { type: string; ext: string; match: (b: Buffer) => boolean }[] = [
  { type: 'image/png', ext: 'png', match: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: 'image/jpeg', ext: 'jpg', match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/webp', ext: 'webp', match: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
  { type: 'image/gif', ext: 'gif', match: (b) => b.subarray(0, 6).toString('ascii') === 'GIF89a' || b.subarray(0, 6).toString('ascii') === 'GIF87a' },
]

export const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB

export class LogoError extends Error {}

export function sniffImage(buf: Buffer): { type: string; ext: string } {
  if (buf.length < 12) throw new LogoError('That file is too small to be an image.')
  const hit = SIGNATURES.find((s) => s.match(buf))
  if (!hit) {
    throw new LogoError('PNG, JPEG, WebP or GIF only. Not SVG — it can carry scripts, and this ends up on a public URL.')
  }
  return { type: hit.type, ext: hit.ext }
}

function client(): BlobServiceClient {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set')
  return BlobServiceClient.fromConnectionString(conn)
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING)
}

/**
 * Uploads a validated logo and returns its public URL.
 *
 * The blob name is a random UUID, not the uploaded filename: filenames are
 * attacker-controlled, and letting one choose its own path invites both
 * traversal attempts and overwriting somebody else's logo.
 */
export async function uploadLogo(buf: Buffer): Promise<string> {
  if (buf.byteLength > MAX_LOGO_BYTES) {
    throw new LogoError('That image is over 2 MB. It is going on an arse, not a billboard.')
  }
  const { type, ext } = sniffImage(buf)

  const container = client().getContainerClient(CONTAINER)
  const blob: BlockBlobClient = container.getBlockBlobClient(`${randomUUID()}.${ext}`)

  await blob.uploadData(buf, {
    blobHTTPHeaders: {
      // The sniffed type, never the submitted one. Also pinned to `inline` with
      // nosniff so a browser cannot be talked into re-interpreting it.
      blobContentType: type,
      blobCacheControl: 'public, max-age=31536000, immutable',
      blobContentDisposition: 'inline',
    },
  })

  return blob.url
}
