import { ZONES } from '@/lib/zones'
import { formatMoney } from '@/lib/money'
import { MIN_INCREMENT_CENTS } from '@/lib/config'

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
    body: 'Your logo goes on as soon as you pay — you do not wait for the auction to end. It stays there, photographed and timestamped, until somebody outbids you, at which point it comes off and theirs goes on. Whoever holds each placement when the clock stops keeps it for the rest of the run.',
  },
] as const

export function HowItWorks() {
  return (
    <section id="how" className="section scroll-mt-20">
      <div className="container-dj">
        <p className="eyebrow">How this works</p>
        <h2 className="mt-3 max-w-3xl text-[40px] sm:text-[56px]">
          It is a real auction, with real money, on a real arse.
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
  { stat: '1', label: 'Arse', note: 'Total addressable inventory. There will not be a second one.' },
  {
    stat: '~14,000',
    label: 'Weekly impressions',
    note: 'Estimated generously. Includes a gym, two beaches, one open-plan office and one regrettable work Christmas party.',
  },
  {
    stat: '100%',
    label: 'Share of voice',
    note: 'There are currently no competing arses in this market. First-mover advantage is real.',
  },
  {
    stat: '2 weeks',
    label: 'Campaign length',
    note: 'Short on purpose. Get outbid and your square centimetre goes to whoever wanted it more.',
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
/*  House rules                                                               */
/* ========================================================================== */

const WONT = [
  ['Anything hateful', 'Obvious. Instant rejection, refunded in full, no discussion.'],
  ['Crypto', 'I have been burned before and so, spiritually, has my arse.'],
  ['Your ex’s name', 'I am not a weapon in somebody else’s divorce.'],
  ['A QR code going somewhere horrible', 'I will scan it. I will find out. You will not enjoy the email.'],
  ['Anything I cannot explain at Christmas', 'My mother reads this website. She has opinions and a phone.'],
] as const

export function HouseRules() {
  return (
    <section id="rules" className="section scroll-mt-20">
      <div className="container-dj grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <p className="eyebrow">House rules</p>
          <h2 className="mt-3 text-[38px] sm:text-[52px]">
            I approve every sponsor by hand.
          </h2>
          <p className="lead mt-4">
            Paying gets you the placement. It does not get you my dignity, which is separately priced and not
            currently for sale. Anyone I reject is refunded in full immediately and we never speak of it again.
          </p>
          <div className="mt-6 rounded-card border border-hairline bg-white p-5">
            <p className="text-[15px] font-semibold">The one hard rule</p>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
              Minimum bid increment is {formatMoney(MIN_INCREMENT_CENTS)}. Bid {formatMoney(MIN_INCREMENT_CENTS)}{' '}
              over someone and you have taken it from them. There is no reserve secret, no proxy bidding, and no
              polite way to lose. Everything is on the board.
            </p>
          </div>

          <div className="mt-4 rounded-card border border-flame/30 bg-flame/5 p-5">
            <p className="text-[15px] font-semibold">Where the money goes</p>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
              The tattoos, the printing, the photography, and a holiday I have been putting off for two years.
              That last one is not a throwaway line. When the auction closes, whoever holds each placement at the
              end gets printed one final time — and comes on the holiday. Your logo will be in the photographs,
              on a beach, on my arse, whether it wants to be there or not.
            </p>
          </div>
        </div>

        <div className="card-dj overflow-hidden">
          <div className="border-b border-hairline2/70 px-6 py-4">
            <h3 className="text-[22px]">Things that will not be going on my arse</h3>
          </div>
          <ul className="divide-y divide-hairline2/60">
            {WONT.map(([title, note]) => (
              <li key={title} className="flex gap-4 px-6 py-4">
                <span aria-hidden className="mt-0.5 text-[18px] leading-none text-hotpink">✕</span>
                <div>
                  <p className="text-[15.5px] font-semibold">{title}</p>
                  <p className="mt-0.5 text-[14px] text-muted">{note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ========================================================================== */
/*  FAQ                                                                       */
/* ========================================================================== */

const FAQ = [
  ['Is this real?', 'Distressingly. There is a database, a payment processor and a man with a printer full of temporary tattoo paper.'],
  [
    'Is it a permanent tattoo?',
    'No. Temporary, and it runs two weeks. If you want permanent, that is a different conversation and a very different number, and you should probably sit down before you have it.',
  ],
  [
    'Do I get proof?',
    'Weekly timestamped photographs. Of my arse. With your logo on it. You are, right now, seriously considering buying this. Sit with that for a second.',
  ],
  [
    'What happens if I get outbid?',
    'Your tattoo comes off and theirs goes on. You are not refunded, and I want to be completely unambiguous about that: the payment bought the time your logo spent on me, and it spent it. The only refund that exists is if your payment lands after someone has already gone higher, in which case your logo never went on at all and you get every cent back automatically.',
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
      <span>pay now, on me now</span>
    </div>
  )
}
