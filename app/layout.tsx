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
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description:
      'Live auction for nine temporary-tattoo advertising placements on one man. Pay and your logo goes on. Get outbid and it comes off.',
    type: 'website',
    url: SITE.baseUrl,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={figtree.variable}>
      <body>{children}</body>
    </html>
  )
}
