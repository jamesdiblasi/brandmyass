import { AuctionBoard } from '@/components/auction-board'
import { LogoMarquee } from '@/components/logo-marquee'
import { SiteFooter, SiteHeader } from '@/components/sections/chrome'
import { Faq, HowItWorks, InventoryStrip, Numbers } from '@/components/sections/content'
import { getAuctionState, getSponsorHistory, type AuctionState, type SponsorHistoryEntry } from '@/lib/auction'
import { ZONES } from '@/lib/zones'

// The board is live and the numbers on it are money. Nothing here may be cached.
export const dynamic = 'force-dynamic'

/**
 * Server-rendered fallback for when the database is not reachable yet — a fresh
 * clone before `npm run db:setup`, or Azure having a moment.
 *
 * The alternative is a 500 on the homepage, which is a poor look for a site
 * whose entire proposition is that you can trust me with your card details.
 */
function offlineState(): AuctionState {
  const closes = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
  return {
    opensAt: new Date().toISOString(),
    closesAt: closes,
    goalCents: 250_000,
    raisedCents: 0,
    settledAt: null,
    open: false,
    serverNow: new Date().toISOString(),
    zones: ZONES.map((z) => ({
      zoneId: z.id,
      reserveCents: z.reserveCents,
      minimumBidCents: z.reserveCents,
      closesAt: closes,
      extensions: 0,
      settled: false,
      closed: false,
      bidCount: 0,
      topBid: null,
    })),
  }
}

export default async function Home() {
  let initial: AuctionState
  let history: SponsorHistoryEntry[] = []
  try {
    initial = await getAuctionState()
    history = await getSponsorHistory()
  } catch (err) {
    console.error('[page] falling back to offline auction state', err)
    initial = offlineState()
  }

  return (
    <>
      <SiteHeader />

      <main>
        <LogoMarquee history={history} />

        {/* ---------------------------------------------------------------- */}
        {/*  Hero                                                            */}
        {/* ---------------------------------------------------------------- */}
        <section className="container-dj pb-10 pt-14 sm:pt-20">
          <div className="max-w-4xl">
            <span className="pill border border-hairline bg-white text-muted">
              <span className="live-dot" aria-hidden />
              Live auction — nine placements, one ass
            </span>

            <h1 className="mt-6 text-[52px] leading-[0.92] sm:text-[82px]">
              Your brand.
              <br />
              My ass.
            </h1>

            <p className="lead mt-6 max-w-2xl">
              Nine advertising placements on one backside, sold to the highest bidder and applied as a
              temporary tattoo for two weeks. If you’re outbid, your tattoo is removed, and replaced with my new
              owner.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#auction" className="btn-filled btn-lg">
                Bid on a cheek
              </a>
              <a href="#how" className="btn-outline btn-lg">
                How this works
              </a>
            </div>

            <div className="mt-7">
              <InventoryStrip />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  The auction                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section className="container-dj pb-6">
          <AuctionBoard initial={{ ...initial, history }} />
        </section>

        <HowItWorks />
        <Numbers />
        <Faq />
      </main>

      <SiteFooter />
    </>
  )
}
