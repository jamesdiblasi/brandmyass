# Brand My Ass

Premium out-of-home advertising. On my ass.

Nine placements on one backside, sold by live auction, applied as temporary
tattoos for **at most two weeks** — less if somebody outbids you. Every bid is
**charged in full** the moment it is placed; your logo goes on immediately and
comes off when somebody pays more. The site itself stays up for a year, so the
record of who held what outlives the tattoos.

---

## What is actually here

| Piece | Where |
| --- | --- |
| Interactive placement map (SVG, keyboard accessible) | `components/ass-picker.tsx` |
| Zone inventory, geometry and sales copy | `lib/zones.ts` |
| Auction engine — outbid, anti-snipe, settlement | `lib/auction.ts` |
| Stripe charges and the one refund path | `lib/stripe.ts` |
| What the webhook decides about your money | `lib/webhook.ts` |
| Schema | `migrations/001_init.sql` |
| Brand tokens lifted from designjoy.co | `tailwind.config.ts`, `app/globals.css` |
| Sponsor logo upload and storage | `lib/blob.ts`, `app/api/logo/route.ts` |

## Sponsor logos

Uploaded during the bid, stored in their own Azure Storage account, and shown
on the placement as soon as the payment clears.

The upload endpoint is reachable before payment, so it is deliberately narrow:
one file, 2 MB cap, and the format decided by **magic bytes** rather than the
Content-Type the browser claims. SVG is refused outright — it is a
script-bearing document, these blobs sit on a public URL, and an SVG accepted
there would be stored XSS on the storage domain. The stored content type is the
one we sniffed, never the one we were handed, and the blob name is a UUID so an
uploader cannot pick its own path or overwrite somebody else's logo.

## The auction rules

- Every zone has its **own clock**. A bidding war over a prime cheek does not
  hold the undercarriages open.
- **Minimum increment $10.** No proxy bidding, no hidden reserve. Everything is
  on the board.
- **Paid in full at bid time.** No deposit, no hold, no capture step. Being
  outbid is **not refunded** — the payment buys the time the logo spends on the
  ass, and that time happened. The one refund path is a payment confirming
  after someone already bid higher, where the logo never went on at all.
- **Anti-snipe:** any bid inside the final 5 minutes pushes that zone's close to
  5 minutes from now. Extensions reset the clock rather than stacking, so the
  auction cannot be compounded into next year.
- A bid becomes the standing bid **only when Stripe confirms the payment** —
  never when the browser says so. Otherwise anyone could take a placement off
  the market for free by typing a large number.

## Live

https://brandmyass-app.azurewebsites.net

Deployed by `.github/workflows/deploy-brandmyass.yml` on every push to the
feature branch that touches `brandmyass/`. It runs in the `leadgen` resource
group (Australia Southeast), on the same App Service Plan as the dashboard —
an extra app on a plan already paid for costs nothing.

It is currently serving the **offline board**: full copy, working placement
map, all nine reserve prices, but no bidding, because `DATABASE_URL` is not set
on the App Service. That is the designed fallback, not a broken deploy.

### Making it take real money

Nobody working on this repo can create repository secrets, so none of the
credentials below are hand-managed. Two workflows generate or fetch them and
write them straight into the App Service:

1. **Provision Brand My Ass infrastructure** (`setup-brandmyass-db.yml`) —
   creates the database, migrates and seeds it, generates a dedicated
   `brandmyass_app` Postgres role, creates the logo storage account, and writes
   `DATABASE_URL` and the storage connection string to the App Service.

   The role matters more than it looks. `brandmyass-app` shares an App Service
   Plan with the dashboard, so it shares the dashboard's **outbound IP** and is
   already inside the Postgres server's IP firewall. The firewall is not a
   boundary between the two apps — the database role is. A public site taking
   card details must not hold a credential that can read `optello`.

2. **Configure Brand My Ass Stripe** (`setup-brandmyass-stripe.yml`) — finds a
   Stripe secret key, registers the webhook endpoint at
   `https://brandmyass-app.azurewebsites.net/api/stripe/webhook` for
   `payment_intent.succeeded`, `payment_intent.payment_failed` and
   `payment_intent.canceled`, and writes `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET` to the App Service. **Until that endpoint exists no
   bid can ever become the standing bid** — by design. It finishes by signing a
   payload with the secret it just installed and posting it at the live site, so
   a green run means the wiring genuinely works.

Two things it cannot do for you:

- **The publishable key has to be typed in once.** Stripe has no API that
  returns it. Run the Stripe workflow with the `publishable_key` input, then
  **redeploy** — `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is compiled into the
  client bundle at build time, so setting it changes nothing until a build
  picks it up. Set it as a runtime app setting alone and the card form silently
  never renders.
- **A firewall rule on the Postgres server** admitting the App Service's
  outbound addresses. The dashboard's `deploy.yml` documents hitting exactly
  this problem with GitHub runners.

Then schedule `npm run auction:settle` at least daily.

If a `BMA_STRIPE_SECRET_KEY` secret does exist, the Stripe workflow prefers it
and never touches the dashboard's key. Make it a **restricted** key (`rk_...`)
limited to PaymentIntents (write), Refunds (write) and Webhook Endpoints
(write): those four capabilities are everything this app does, and the fallback
of borrowing the dashboard's full secret key puts a credential that can read
every customer and payout on the account onto a public joke website.

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

Closes every zone whose clock has run out and records the winner. No money
moves — every bid was charged when placed — so this is bookkeeping, and
forgetting to run it costs nobody anything.

## Testing the flow end to end

1. Bid on a zone with card `4242 4242 4242 4242`.
2. Watch the board promote you to standing bid once the webhook lands.
3. Bid again, higher, with a different email.
4. Check the Stripe dashboard: both payments are captured, and the first is NOT
   refunded. That is the model working as intended.
5. Decline a card once (`4000 0000 0000 0002`), then pay with `4242…` on the
   same form. The bid must still be promoted — a declined attempt is not the
   end of a PaymentIntent, and treating it as one charges people for nothing.

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
  mail provider wired up. The demotion is real; the smug email is not.
- `logo_url` is accepted as given. It is written by our own upload endpoint in
  the normal flow, but a hand-made request can put any URL there and it will be
  rendered on the board once that bid pays. It should be constrained to the
  storage account's host.
- There is no admin screen for approving or rejecting sponsors; the copy
  promises hand approval, and right now that is done in SQL.
