'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AuctionState, SponsorHistoryEntry, ZoneAuctionState } from '@/lib/auction'
import { TIER_COLOR, TIER_LABEL, ZONES, getZone } from '@/lib/zones'
import { formatMoney } from '@/lib/money'
import { POLL_INTERVAL_MS } from '@/lib/config'
import { safeHref } from '@/lib/links'
import { AssPicker } from './ass-picker'
import { BidPanel } from './bid-panel'
import { Countdown } from './countdown'

interface BoardData extends AuctionState {
  history?: SponsorHistoryEntry[]
}

export function AuctionBoard({ initial }: { initial: BoardData }) {
  const [data, setData] = useState<BoardData>(initial)
  // Selected by id, not index. This was ZONES[4], which silently pointed at a
  // different cheek the moment a zone earlier in the list was removed.
  const [selectedId, setSelectedId] = useState<string>(getZone('left-prime')?.id ?? ZONES[0].id)
  const [stale, setStale] = useState(false)
  // A logo the visitor has uploaded but not yet paid for. Local to this browser
  // — nobody else can see it, because nobody else has bought anything.
  const [preview, setPreview] = useState<{ zoneId: string; logoUrl: string } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auction', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
      setStale(false)
    } catch {
      // A blip is not worth an error state on screen; the badge goes grey and
      // the next tick usually fixes it.
      setStale(true)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL_MS)
    // A tab left open for an hour should catch up the instant it is looked at.
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  const states = useMemo(
    () => new Map<string, ZoneAuctionState>(data.zones.map((z) => [z.zoneId, z])),
    [data.zones],
  )

  // Once the server is serving the same logo, the placement is real and the
  // preview has nothing left to say. Dropping it here rather than on payment
  // means the badge stops saying NOT PAID at the moment it stops being true.
  useEffect(() => {
    if (!preview) return
    if (states.get(preview.zoneId)?.topBid?.logoUrl === preview.logoUrl) setPreview(null)
  }, [states, preview])

  const selectedZone = getZone(selectedId) ?? ZONES[0]
  const sold = data.zones.filter((z) => z.topBid).length
  // Math.min() with no arguments is Infinity, which renders as "$Infinity" the
  // moment the last zone closes. Guard the empty case rather than the format.
  const openZones = data.zones.filter((z) => !z.closed)
  const cheapestEntry = openZones.length > 0 ? Math.min(...openZones.map((z) => z.minimumBidCents)) : 0
  const pct = data.goalCents > 0 ? Math.round((data.raisedCents / data.goalCents) * 100) : 0

  return (
    <div id="auction" className="scroll-mt-20">
      {/* --- campaign scoreboard ------------------------------------------- */}
      <div className="card-dj mb-6 overflow-hidden">
        <div className="grid divide-y divide-hairline2/70 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <Metric
            label={
              <span className="inline-flex items-center gap-2">
                <span className={stale ? 'h-2 w-2 rounded-full bg-muted' : 'live-dot'} />
                {stale ? 'Reconnecting' : 'Live bidding'}
              </span>
            }
            value={<Countdown to={data.closesAt} />}
            sub="until the whole thing closes"
          />
          <Metric label="Raised so far" value={formatMoney(data.raisedCents)} sub={`${pct}% of target`} />
          <Metric label="Placements taken" value={`${sold} / ${data.zones.length}`} sub="the rest are going cheap" />
          <Metric
            label={openZones.length > 0 ? 'Cheapest way in' : 'Auction'}
            value={openZones.length > 0 ? formatMoney(cheapestEntry) : 'Closed'}
            sub={openZones.length > 0 ? 'pathetic, but valid' : 'that is the lot'}
          />
        </div>

        <div className="h-2 w-full bg-canvas">
          <div
            className="h-full bg-flame transition-[width] duration-700"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* --- picker + panel ------------------------------------------------ */}
      <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start">
        <div className="card-dj p-4 sm:p-6">
          <AssPicker states={states} selectedId={selectedId} onSelect={setSelectedId} preview={preview} />
        </div>

        <div className="lg:sticky lg:top-6">
          <BidPanel
            zone={selectedZone}
            state={states.get(selectedId)}
            onBidPlaced={refresh}
            onLogoPreview={(logoUrl) => setPreview(logoUrl ? { zoneId: selectedId, logoUrl } : null)}
          />
        </div>
      </div>

      {/* --- everyone who has ever owned a piece --------------------------- */}
      {data.history && data.history.length > 0 && (
        <div className="card-dj mt-8 overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline2/70 px-5 py-4">
            <h3 className="text-[22px]">Previously, on my ass</h3>
            <p className="text-[13px] text-muted">
              Every company that has ever held a placement. Being outbid gets you off me, not off this list.
            </p>
          </div>
          <ul className="divide-y divide-hairline2/60">
            {data.history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex items-center gap-4 px-5 py-3">
                {(() => {
                  const href = safeHref(h.sponsorUrl)
                  const thumb = (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-btn border border-hairline bg-white">
                      {h.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.logoUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span aria-hidden className="text-[18px]">🍑</span>
                      )}
                    </div>
                  )
                  return href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${h.sponsorName} website`}>
                      {thumb}
                    </a>
                  ) : (
                    thumb
                  )
                })()}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {safeHref(h.sponsorUrl) ? (
                      <a
                        href={safeHref(h.sponsorUrl)}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="truncate font-semibold underline decoration-hairline underline-offset-4 hover:decoration-ink"
                      >
                        {h.sponsorName}
                      </a>
                    ) : (
                      <span className="truncate font-semibold">{h.sponsorName}</span>
                    )}
                    <span className="text-[13px] text-muted">
                      {getZone(h.zoneId)?.name ?? h.zoneId} · {formatMoney(h.amountCents)}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted">
                    {new Date(h.at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                {h.status === 'active' && <span className="pill shrink-0 bg-flame text-white">ON ME NOW</span>}
                {h.status === 'outbid' && <span className="pill shrink-0 bg-canvas text-muted">WORN &amp; OUTBID</span>}
                {h.status === 'won' && <span className="pill shrink-0 bg-gold text-ink">FINAL OWNER</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- the rate card -------------------------------------------------- */}
      <div className="card-dj mt-8 overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline2/70 px-5 py-4">
          <h3 className="text-[22px]">Full rate card</h3>
          <p className="text-[13px] text-muted">All prices AUD. All placements on one man.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead className="bg-canvas text-[11px] uppercase tracking-[0.1em] text-muted">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Placement</th>
                <th className="px-3 py-2.5 font-semibold">Tier</th>
                <th className="px-3 py-2.5 font-semibold">Size</th>
                <th className="px-3 py-2.5 font-semibold">Bids</th>
                <th className="px-3 py-2.5 font-semibold">Standing bid</th>
                <th className="px-3 py-2.5 font-semibold">Closes</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline2/60">
              {ZONES.map((zone) => {
                const s = states.get(zone.id)
                return (
                  <tr
                    key={zone.id}
                    className={`transition-colors hover:bg-canvas/60 ${
                      selectedId === zone.id ? 'bg-canvas' : ''
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div className="font-semibold">{zone.name}</div>
                      <div className="text-[12.5px] text-muted">{zone.pitch}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="pill text-white"
                        style={{ backgroundColor: TIER_COLOR[zone.tier] }}
                      >
                        {TIER_LABEL[zone.tier]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">{zone.size}</td>
                    <td className="px-3 py-3 text-muted">{s?.bidCount ?? 0}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold">
                      {s?.topBid ? formatMoney(s.topBid.amountCents) : <span className="text-muted">no bids</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">
                      {s ? <Countdown to={s.closesAt} /> : '—'}
                      {s && s.extensions > 0 && (
                        <span className="ml-1.5 text-[11px] font-semibold text-flame">
                          +{s.extensions} snipe
                          {s.extensions > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedId(zone.id)
                          document.getElementById('auction')?.scrollIntoView({ behavior: 'smooth' })
                        }}
                        className="btn-outline whitespace-nowrap"
                      >
                        {s?.topBid ? 'Outbid' : 'Claim it'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

function Metric({
  label,
  value,
  sub,
}: {
  label: React.ReactNode
  value: React.ReactNode
  sub: string
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="mt-1 text-[28px] font-medium leading-none tracking-[-0.03em]">{value}</div>
      <div className="mt-1 text-[12.5px] text-muted">{sub}</div>
    </div>
  )
}
