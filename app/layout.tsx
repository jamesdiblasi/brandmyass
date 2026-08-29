import type { Metadata } from 'next'
import { Figtree } from 'next/font/google'
import { SITE } from '@/lib/config'
import './globals.css'

// Designjoy's typeface, and the single biggest reason their site reads the way
// it does. Weight 500 is what headings use — not 700.
const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-figtree',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.baseUrl),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description:
    'Nine advertising placements. One backside. Pay for a cheek and I temp-tattoo your logo onto the exact square centimetre you paid for — until somebody pays more.',
  // The share card images live next to this file as opengraph-image.png and
  // twitter-image.png — Next's file convention attaches them (absolute URLs
  // via metadataBase) so a link pasted on X unfurls the beach.
  openGraph: {
    title: 'Brand My Ass — I’m selling ad space on my ass',
    description:
      'Nine advertisement placements on one ass, sold at live auction and temp-tattooed on for two weeks. Get outbid and your logo comes off. Bidding is open now.',
    type: 'website',
    url: SITE.baseUrl,
    siteName: SITE.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brand My Ass — I’m selling ad space on my ass',
    description:
      'Nine advertisement placements on one ass, sold at live auction and temp-tattooed on for two weeks. Get outbid and your logo comes off. Bidding is open now.',
    creator: '@thatjsd',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={figtree.variable}>
      <body>{children}</body>
    </html>
  )
}
