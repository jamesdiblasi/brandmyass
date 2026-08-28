'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AuctionState, ZoneAuctionState } from '@/lib/auction'
import { TIER_COLOR, TIER_LABEL, ZONES, getZone } from '@/lib/zones'
import { formatMoney } from '@/lib/money'
import { POLL_INTERVAL_MS } from '@/lib/config'
import { AssPicker } from './ass-picker'
import { BidPanel } from './bid-panel'
import { Countdown } from './countdown'

interface RecentBid {
  zoneId: string
  amountCents: number
  sponsorName: string
  status: string
  at: string
}

interface BoardData extends AuctionState {
  recent?: RecentBid[]
}

export function AuctionBoard({ initial }: { initial: BoardData }) {
  const [data, setData] = useState<BoardData>(initial)
  const [selectedId, setSelectedId] = useState<string>(ZONES[4].id) // Left Prime Cheek
  const [stale, setStale] = useState(false)

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
          <AssPicker states={states} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="lg:sticky lg:top-6">
          <BidPanel zone={selectedZone} state={states.get(selectedId)} onBidPlaced={refresh} />
        </div>
      </div>

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

      {/* --- activity ticker ------------------------------------------------ */}
      {data.recent && data.recent.length > 0 && (
        <div className="card-dj mt-8 p-5">
          <h3 className="text-[20px]">Recent shame</h3>
          <ul className="mt-3 divide-y divide-hairline2/60">
            {data.recent.map((bid, i) => (
              <li key={`${bid.at}-${i}`} className="flex flex-wrap items-baseline gap-x-2 py-2 text-[14px]">
                <span className="font-semibold">{bid.sponsorName}</span>
                <span className="text-muted">bid</span>
                <span className="font-semibold">{formatMoney(bid.amountCents)}</span>
                <span className="text-muted">on</span>
                <span className="font-medium">{getZone(bid.zoneId)?.name ?? bid.zoneId}</span>
                {bid.status === 'outbid' && (
                  <span className="pill bg-canvas text-muted">outbid, hold released</span>
                )}
                {bid.status === 'won' && <span className="pill bg-gold text-ink">WON</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
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
