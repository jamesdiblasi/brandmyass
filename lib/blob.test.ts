import { describe, expect, it } from 'vitest'
import { LogoError, sniffImage } from './blob'

/**
 * The magic-byte check is the security control on a public upload endpoint, so
 * it is tested against real signatures rather than eyeballed.
 */
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)])
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)])
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)])

describe('sniffImage', () => {
  it('accepts the four raster formats we serve', () => {
    expect(sniffImage(PNG)).toEqual({ type: 'image/png', ext: 'png' })
    expect(sniffImage(JPEG)).toEqual({ type: 'image/jpeg', ext: 'jpg' })
    expect(sniffImage(WEBP)).toEqual({ type: 'image/webp', ext: 'webp' })
    expect(sniffImage(GIF)).toEqual({ type: 'image/gif', ext: 'gif' })
  })

  it('rejects SVG, which is a script-bearing document on a public URL', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    expect(() => sniffImage(svg)).toThrow(LogoError)
  })

  it('rejects HTML dressed up as an image', () => {
    // The exact attack the sniffing exists to stop: a browser-declared
    // Content-Type of image/png on a file that is actually a page.
    expect(() => sniffImage(Buffer.from('<!doctype html><script>alert(1)</script>'))).toThrow(LogoError)
  })

  it('rejects a file that merely ends in the right bytes', () => {
    const trailing = Buffer.concat([Buffer.from('<html>'), PNG])
    expect(() => sniffImage(trailing)).toThrow(LogoError)
  })

  it('rejects something too short to identify', () => {
    expect(() => sniffImage(Buffer.from([0x89, 0x50]))).toThrow(LogoError)
  })
})
