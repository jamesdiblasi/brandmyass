'use client'

import { useEffect, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import type { ZoneAuctionState } from '@/lib/auction'
import { TIER_COLOR, TIER_LABEL, type Zone } from '@/lib/zones'
import { formatMoney, parseMoneyToCents } from '@/lib/money'
import { ANTI_SNIPE_WINDOW_MS } from '@/lib/config'
import { Countdown, useIsClosingSoon } from './countdown'

// Loaded once, at module scope — loadStripe injects a script tag and calling it
// per render would add one on every keystroke.
const stripePromise: Promise<Stripe | null> | null = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

interface Props {
  zone: Zone
  state: ZoneAuctionState | undefined
  onBidPlaced: () => void
}

type Phase = 'form' | 'card' | 'done'

export function BidPanel({ zone, state, onBidPlaced }: Props) {
  const [phase, setPhase] = useState<Phase>('form')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [depositCents, setDepositCents] = useState(0)

  const minimum = state?.minimumBidCents ?? zone.reserveCents
  const [amount, setAmount] = useState(() => String(minimum / 100))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Changing zones must reset everything — otherwise a half-finished bid on the
  // Ravine follows you to the undercarriage.
  useEffect(() => {
    setPhase('form')
    setClientSecret(null)
    setError(null)
    setAmount(String((state?.minimumBidCents ?? zone.reserveCents) / 100))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.id])

  const tier = TIER_COLOR[zone.tier]
  const closed = state?.closed ?? false
  const closingSoon = useIsClosingSoon(state?.closesAt ?? new Date().toISOString(), ANTI_SNIPE_WINDOW_MS)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cents = parseMoneyToCents(amount)
    if (cents === null) return setError('Write that as a number. Like a grown-up.')
    if (cents < minimum) return setError(`Minimum bid is ${formatMoney(minimum)}. Do keep up.`)

    setBusy(true)
    try {
      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId: zone.id,
          amountCents: cents,
          sponsorName: name,
          sponsorEmail: email,
          sponsorUrl: url || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'That did not work.')
        return
      }
      setClientSecret(data.clientSecret)
      setDepositCents(data.depositCents)
      setPhase('card')
    } catch {
      setError('Could not reach the server. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  if (closed) {
    return (
      <div className="card-dj p-6">
        <ZoneHeader zone={zone} tier={tier} />
        <div className="mt-5 rounded-btn bg-canvas p-4 text-[15px]">
          <p className="font-medium">This one has closed.</p>
          <p className="mt-1 text-muted">
            {state?.topBid
              ? `${state.topBid.sponsorName} won it for ${formatMoney(state.topBid.amountCents)}. It is being drawn on me as we speak.`
              : 'Nobody wanted it. I am choosing not to take that personally.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card-dj p-6">
      <ZoneHeader zone={zone} tier={tier} />

      <p className="mt-4 text-[15px] leading-relaxed text-muted">{zone.blurb}</p>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-btn bg-hairline2/70 text-[13px]">
        <Stat label="Standing bid" value={state?.topBid ? formatMoney(state.topBid.amountCents) : '—'} />
        <Stat label="Bids" value={String(state?.bidCount ?? 0)} />
        <Stat label="Minimum next bid" value={formatMoney(minimum)} accent />
        <Stat
          label={closingSoon ? 'Closing — anti-snipe armed' : 'Closes in'}
          value={<Countdown to={state?.closesAt ?? ''} />}
          accent={closingSoon}
        />
      </dl>

      {state?.topBid && (
        <p className="mt-3 text-[13px] text-muted">
          Currently held by <span className="font-semibold text-ink">{state.topBid.sponsorName}</span>. Take it
          off them. They will get an email about it.
        </p>
      )}

      {phase === 'form' && (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <Field label={`Your bid — ${formatMoney(minimum)} or more`}>
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium text-muted">$</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                required
                className="w-full rounded-btn border border-hairline bg-white px-3 py-2.5 text-lg font-medium outline-none focus:border-ink"
              />
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Brand name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                placeholder="Acme Corp"
                className="w-full rounded-btn border border-hairline bg-white px-3 py-2.5 text-[15px] outline-none focus:border-ink"
              />
            </Field>
            <Field label="Email">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="you@company.com"
                className="w-full rounded-btn border border-hairline bg-white px-3 py-2.5 text-[15px] outline-none focus:border-ink"
              />
            </Field>
          </div>

          <Field label="Link for the sponsor wall (optional)">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              placeholder="https://acme.com"
              className="w-full rounded-btn border border-hairline bg-white px-3 py-2.5 text-[15px] outline-none focus:border-ink"
            />
          </Field>

          {error && (
            <p className="rounded-btn bg-hotpink/10 px-3 py-2 text-[14px] font-medium text-hotpink">{error}</p>
          )}

          <button type="submit" disabled={busy} className="btn-filled btn-lg w-full">
            {busy ? 'Hold on…' : `Bid ${amount ? `$${amount}` : ''} on ${zone.name}`}
          </button>

          <p className="text-center text-[12.5px] leading-snug text-muted">
            We place a 20% hold on your card — not a charge. Get outbid and it vanishes like it never happened.
            Win and we take the hold, then invoice the rest.
          </p>
        </form>
      )}

      {phase === 'card' && clientSecret && stripePromise && (
        <div className="mt-6">
          <div className="mb-4 rounded-btn bg-canvas p-3 text-[14px]">
            Hold of <span className="font-semibold">{formatMoney(depositCents)}</span> on your card. Not a charge.
            Not yet.
          </div>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'flat',
                variables: {
                  colorPrimary: '#000000',
                  colorBackground: '#ffffff',
                  colorText: '#000000',
                  fontFamily: 'Figtree, system-ui, sans-serif',
                  borderRadius: '8px',
                },
              },
            }}
          >
            <CardStep
              onDone={() => {
                setPhase('done')
                onBidPlaced()
              }}
            />
          </Elements>
        </div>
      )}

      {phase === 'card' && !stripePromise && (
        <p className="mt-6 rounded-btn bg-gold/20 p-3 text-[14px]">
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set, so the card step cannot render. The bid was recorded as
          pending.
        </p>
      )}

      {phase === 'done' && (
        <div className="mt-6 rounded-btn border border-lime bg-lime/15 p-4">
          <p className="text-[15px] font-semibold">Hold placed. You are in.</p>
          <p className="mt-1 text-[14px] text-muted">
            The board updates the moment your bank confirms — usually seconds. If someone outbids you, your hold
            is released automatically and you will get an email that is, frankly, quite smug about it.
          </p>
        </div>
      )}
    </div>
  )
}

function CardStep({ onDone }: { onDone: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)

    // `redirect: 'if_required'` keeps card payments inline while still allowing
    // methods that genuinely need a redirect to take one.
    const { error: err } = await stripe.confirmPayment({ elements, redirect: 'if_required' })

    if (err) {
      setError(err.message ?? 'Your bank said no.')
      setBusy(false)
      return
    }
    setBusy(false)
    onDone()
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <PaymentElement />
      {error && <p className="rounded-btn bg-hotpink/10 px-3 py-2 text-[14px] font-medium text-hotpink">{error}</p>}
      <button type="submit" disabled={!stripe || busy} className="btn-filled btn-lg w-full">
        {busy ? 'Talking to your bank…' : 'Authorise the hold'}
      </button>
    </form>
  )
}

function ZoneHeader({ zone, tier }: { zone: Zone; tier: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill text-white" style={{ backgroundColor: tier }}>
          {TIER_LABEL[zone.tier]}
        </span>
        <span className="pill border border-hairline text-muted">{zone.size}</span>
        <span className="pill border border-hairline text-muted">
          Opens at {formatMoney(zone.reserveCents)}
        </span>
      </div>
      <h3 className="mt-3 text-[34px] leading-none">{zone.name}</h3>
      <p className="mt-2 text-[15px] font-medium">{zone.pitch}</p>
    </div>
  )
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <div className="bg-white px-3 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className={`mt-0.5 text-[17px] font-semibold ${accent ? 'text-flame' : 'text-ink'}`}>{value}</dd>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      {children}
    </label>
  )
}
