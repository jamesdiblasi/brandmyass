import { ZONES } from '@/lib/zones'
import { formatMoney } from '@/lib/money'

/* ========================================================================== */
/*  How it works                                                              */
/* ========================================================================== */

const STEPS = [
  {
    n: '01',
    title: 'Pick a cheek',
    body: 'Nine placements, priced honestly by how many human beings will realistically see them. Some are prime real estate. One of them is, frankly, the underside of a thigh, and it is priced like it.',
  },
  {
    n: '02',
    title: 'Pay, and hold your nerve',
    body: 'You pay your bid there and then — the full amount, not a deposit. It is not refunded when somebody outbids you, because what you bought was the time your logo actually spent on me, and you got it. Bid in the last five minutes and the clock gets pushed out, so nobody takes a placement off you by having better wifi.',
  },
  {
    n: '03',
    title: 'I get tattooed. Immediately.',
    body: 'Your logo goes on as soon as you pay — you do not wait for the auction to end. Two weeks is the most it can stay there, and it is less than that if somebody outbids you, at which point it comes off and theirs goes on. The website is the part that lasts: it stays up for a year, with your name against every placement you held.',
  },
] as const

export function HowItWorks() {
  return (
    <section id="how" className="section scroll-mt-20">
      <div className="container-dj">
        <p className="eyebrow">How this works</p>
        <h2 className="mt-3 max-w-3xl text-[40px] sm:text-[56px]">
          It is a real auction, with real money, on a real ass.
        </h2>
        <p className="lead mt-4 max-w-2xl">
          Three steps. None of them are a metaphor.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card-dj p-6">
              <span className="text-[13px] font-semibold tracking-[0.14em] text-flame">{s.n}</span>
              <h3 className="mt-3 text-[26px]">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ========================================================================== */
/*  The media kit, played completely straight                                 */
/* ========================================================================== */

const NUMBERS = [
  {
    stat: '1',
    label: 'Ass',
    note: 'Total addressable inventory. There are no competing asses in this market, so share of voice is a clean 100%.',
  },
  {
    stat: '~14,000',
    label: 'Weekly impressions',
    note: 'Estimated generously. Includes a gym, two beaches, one open-plan office and one regrettable work Christmas party.',
  },
  {
    stat: '2 weeks',
    label: 'Maximum time on me',
    note: 'The ceiling, not the promise. Somebody outbids you and it comes off early — that is the entire game.',
  },
  {
    stat: '1 year',
    label: 'Time on this website',
    note: 'The tattoo is temporary. The receipt is not: this page stays up for a year with your logo on the placement you bought.',
  },
] as const

export function Numbers() {
  return (
    <section id="numbers" className="section scroll-mt-20">
      <div className="container-dj">
        <div className="card-dj overflow-hidden">
          <div className="border-b border-hairline2/70 px-6 py-8 sm:px-10">
            <p className="eyebrow">Media kit</p>
            <h2 className="mt-3 max-w-3xl text-[36px] sm:text-[50px]">
              The numbers, presented with a straight face.
            </h2>
            <p className="lead mt-4 max-w-2xl">
              Every out-of-home media pack you have ever been sent was this confident and had less evidence.
            </p>
          </div>
          <div className="grid divide-y divide-hairline2/70 sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
            {NUMBERS.map((n) => (
              <div key={n.label} className="px-6 py-7">
                <div className="text-[44px] font-medium leading-none tracking-[-0.04em]">{n.stat}</div>
                <div className="mt-2 text-[15px] font-semibold">{n.label}</div>
                <p className="mt-2 text-[13.5px] leading-snug text-muted">{n.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ========================================================================== */
/*  FAQ                                                                       */
/* ========================================================================== */

const FAQ = [
  ['Is this real?', 'Disturbingly so. The internet is full of idiots, I’ve built consultancies, so now the next step is to brand my ass…'],
  [
    'Is it a permanent tattoo?',
    'No. Temporary, and two weeks is the ceiling — less if somebody outbids you first. The lasting part is this website, which stays up for a year with your logo sitting on the placement you paid for.',
  ],
  [
    'Do I get proof?',
    'Weekly timestamped photographs. Of my ass. With your logo on it. You are, right now, seriously considering buying this. Sit with that for a second.',
  ],
  [
    'What happens if I get outbid?',
    'Your tattoo comes off and theirs goes on, and you keep your place in the record on this website for the year it stays up. You are not refunded, and I want to be completely unambiguous about that: the payment bought the time your logo spent on me, and it spent it.',
  ],
  [
    'Can I buy all nine placements?',
    'You can, and I would very much like you to. You would become the sole sponsor of an entire human backside, which is a sentence no marketing department has ever put in a quarterly report.',
  ],
  [
    'Can my logo be bigger than the placement?',
    'No. This is a rate card, not a negotiation. The sizes are printed next to the prices for exactly this reason.',
  ],
  [
    'Where does the money go?',
    'The tattoos, the photography, the hosting, and a holiday I have been putting off for two years. The holiday will also be photographed. Your logo will be there. (For the final bidders).',
  ],
  [
    'What if nobody bids on my favourite cheek?',
    'Then it goes unsold, and I will spend the rest of the campaign quietly wondering what was wrong with it. Do not let this happen.',
  ],
] as const

export function Faq() {
  return (
    <section id="faq" className="section scroll-mt-20">
      <div className="container-dj">
        <p className="eyebrow">Questions</p>
        <h2 className="mt-3 text-[38px] sm:text-[52px]">Things people ask, immediately.</h2>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card-dj group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16.5px] font-semibold">
                {q}
                <span
                  aria-hidden
                  className="shrink-0 text-[20px] leading-none text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ========================================================================== */
/*  Inventory teaser — used above the fold                                     */
/* ========================================================================== */

export function InventoryStrip() {
  const cheapest = Math.min(...ZONES.map((z) => z.reserveCents))
  const dearest = Math.max(...ZONES.map((z) => z.reserveCents))
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-muted">
      <span>
        <strong className="font-semibold text-ink">{ZONES.length}</strong> placements
      </span>
      <span aria-hidden className="text-hairline">•</span>
      <span>
        from <strong className="font-semibold text-ink">{formatMoney(cheapest)}</strong> to{' '}
        <strong className="font-semibold text-ink">{formatMoney(dearest)}</strong>
      </span>
      <span aria-hidden className="text-hairline">•</span>
      <span>two weeks on me, a year on here</span>
    </div>
  )
}
