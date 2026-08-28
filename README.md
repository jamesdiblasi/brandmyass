# Brand My Ass

Premium out-of-home advertising. On my arse.

Ten placements on one backside, sold by live auction, applied as temporary
tattoos for six weeks. Bidding takes a card **hold**, not a charge — get outbid
and it disappears.

---

## What is actually here

| Piece | Where |
| --- | --- |
| Interactive placement map (SVG, keyboard accessible) | `components/ass-picker.tsx` |
| Zone inventory, geometry and sales copy | `lib/zones.ts` |
| Auction engine — outbid, anti-snipe, settlement | `lib/auction.ts` |
| Stripe card holds, release and capture | `lib/stripe.ts` |
| Schema | `migrations/001_init.sql` |
| Brand tokens lifted from designjoy.co | `tailwind.config.ts`, `app/globals.css` |

## The auction rules

- Every zone has its **own clock**. A bidding war over The Ravine does not hold
  the undercarriages open.
- **Minimum increment $10.** No proxy bidding, no hidden reserve. Everything is
  on the board.
- **20% card hold**, authorised not captured. Outbid releases it automatically.
  Winning captures it, and the balance is invoiced separately.
- **Anti-snipe:** any bid inside the final 5 minutes pushes that zone's close to
  5 minutes from now. Extensions reset the clock rather than stacking, so the
  auction cannot be compounded into next year.
- A bid becomes the standing bid **only when Stripe confirms the hold** — never
  when the browser says so. Otherwise anyone could take a placement off the
  market for free by typing a large number.

## Setup

```bash
cp .env.example .env.local        # fill in real values
npm install

npm run db:create                 # creates the brandmyass database (admin creds)
npm run db:migrate                # applies migrations/*.sql
npm run db:seed                   # opens the campaign, seeds the 10 zones

npm run dev                       # http://localhost:3002
```

Webhooks, in a second terminal:

```bash
stripe listen --forward-to localhost:3002/api/stripe/webhook
```

Paste the printed `whsec_...` into `.env.local` as `STRIPE_WEBHOOK_SECRET` and
restart. **Until this is running, no bid can ever become the standing bid** —
that is by design, not a bug.

## Settlement

```bash
npm run auction:settle
```

Closes every zone whose clock has run out and captures the winners' holds.
Idempotent, so run it on a schedule — **at least daily**. Stripe expires an
uncaptured authorisation after about 7 days, so a campaign longer than that
needs this job running or winners' holds will lapse.

## Testing the flow end to end

1. Bid on a zone with card `4242 4242 4242 4242`.
2. Watch the board promote you to standing bid once the webhook lands.
3. Bid again, higher, with a different email.
4. Check the Stripe dashboard: the first PaymentIntent is now `canceled` and the
   hold is gone. That is the whole promise of the site, working.

## Moving this into its own repository

It was built self-contained for exactly this reason — nothing here imports from
the parent project.

```bash
git subtree split --prefix=brandmyass -b brandmyass-only
# then, against an empty repo you have created:
git push git@github.com:<you>/brandmyass.git brandmyass-only:main
```

## Known gaps

- Outbid **emails** are described in the copy but not implemented — there is no
  mail provider wired up. The hold release is real; the smug email is not.
- Sponsor logo upload is a URL field, not a file upload.
- There is no admin screen for approving or rejecting sponsors; the copy
  promises hand approval, and right now that is done in SQL.
