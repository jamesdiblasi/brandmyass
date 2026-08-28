import Link from 'next/link'
import { SITE } from '@/lib/config'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline2/60 bg-canvas/85 backdrop-blur">
      <div className="container-dj flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.02em]">
          <span aria-hidden className="text-[22px] leading-none">🍑</span>
          {SITE.name}
        </Link>
        <nav className="hidden items-center gap-6 text-[15px] font-medium text-muted md:flex">
          <a href="#how" className="transition-colors hover:text-ink">How it works</a>
          <a href="#numbers" className="transition-colors hover:text-ink">The numbers</a>
          <a href="#rules" className="transition-colors hover:text-ink">House rules</a>
          <a href="#faq" className="transition-colors hover:text-ink">FAQ</a>
        </nav>
        <a href="#auction" className="btn-filled">Bid on a cheek</a>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline2/60">
      <div className="container-dj flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[17px] font-semibold">{SITE.name}</p>
          <p className="mt-1 max-w-md text-[14px] text-muted">
            An independent out-of-home media network consisting of one man and his backside. Established out of
            spite. Operated out of a spare room.
          </p>
        </div>
        <div className="text-[14px] text-muted sm:text-right">
          <a href={`mailto:${SITE.contactEmail}`} className="font-medium text-ink underline decoration-hairline underline-offset-4">
            {SITE.contactEmail}
          </a>
          <p className="mt-2">Payments by Stripe. Tattoos by hand. Regrets by the dozen.</p>
          <p className="mt-1">© {new Date().getFullYear()} — all cheeks reserved.</p>
        </div>
      </div>
    </footer>
  )
}
