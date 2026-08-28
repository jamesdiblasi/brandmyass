'use client'

import { useId, useState } from 'react'
import { BODY, CLEFT_PATH, FOLD_PATHS, TIER_COLOR, ZONES, shortLabel, type Zone } from '@/lib/zones'
import type { ZoneAuctionState } from '@/lib/auction'
import { formatMoney } from '@/lib/money'

/**
 * The interactive arse.
 *
 * Structure, from the bottom up:
 *   1. the body — five overlapping shapes filled as ONE group, so the joins
 *      between torso, cheeks and thighs never show as seams. A drop-shadow on
 *      the group outlines the union; stroking the shapes individually would
 *      draw every internal edge and ruin it.
 *   2. a <g clip-path> holding one rounded rect per zone — clipping is what
 *      lets rectangles read as anatomy instead of as a spreadsheet
 *   3. the cleft and the gluteal folds, which do most of the anatomical work
 *   4. labels and hotspots, deliberately OUTSIDE the clip so they are never
 *      sliced in half at the body's edge
 *
 * Every zone is a real focusable button with an aria-label, so the whole thing
 * is operable from a keyboard. A site about arses is not an excuse to ship
 * something a screen reader cannot use.
 */

interface Props {
  states: Map<string, ZoneAuctionState>
  selectedId: string | null
  onSelect: (zoneId: string) => void
}

export function AssPicker({ states, selectedId, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const uid = useId().replace(/:/g, '')
  const clipId = `body-clip-${uid}`
  const shadeId = `body-shade-${uid}`
  const hatchId = `hatch-${uid}`

  return (
    <div className="relative w-full">
      <svg
        viewBox="40 108 520 604"
        className="w-full h-auto max-h-[70vh] select-none touch-manipulation"
        role="group"
        aria-label="Interactive map of available advertising placements"
      >
        <defs>
          {/* Several children in one clipPath union together — that union is
              the body, and every zone rect is clipped to it. */}
          <clipPath id={clipId}>
            <path d={BODY.torso} />
            <ellipse {...BODY.leftCheek} />
            <ellipse {...BODY.rightCheek} />
            <path d={BODY.leftThigh} />
            <path d={BODY.rightThigh} />
          </clipPath>

          {/* Enough tonal range that the silhouette reads against a white card
              without competing with the zone fills painted on top of it. */}
          <radialGradient id={shadeId} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#f3ecee" />
            <stop offset="62%" stopColor="#e7dde0" />
            <stop offset="100%" stopColor="#d2c4c9" />
          </radialGradient>

          {/* Diagonal hatch marks a placement that is already spoken for. */}
          <pattern id={hatchId} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#000" strokeOpacity="0.06" strokeWidth="4" />
          </pattern>
        </defs>

        {/* 1 — the body, filled as one group so the overlaps are invisible */}
        <g
          fill={`url(#${shadeId})`}
          style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.16))' }}
        >
          <path d={BODY.torso} />
          <ellipse {...BODY.leftCheek} />
          <ellipse {...BODY.rightCheek} />
          <path d={BODY.leftThigh} />
          <path d={BODY.rightThigh} />
        </g>

        {/* 2 — the inventory grid, clipped to the body */}
        <g clipPath={`url(#${clipId})`}>
          {ZONES.map((zone) => {
            const state = states.get(zone.id)
            const isSelected = selectedId === zone.id
            const isHovered = hovered === zone.id
            const taken = Boolean(state?.topBid)
            const tier = TIER_COLOR[zone.tier]

            const opacity = isSelected ? 0.48 : isHovered ? 0.32 : taken ? 0.2 : 0.07

            return (
              <g key={zone.id}>
                <rect
                  x={zone.rect.x + 3}
                  y={zone.rect.y + 3}
                  width={zone.rect.w - 6}
                  height={zone.rect.h - 6}
                  rx={12}
                  fill={taken || isSelected || isHovered ? tier : '#000'}
                  opacity={opacity}
                  className="transition-opacity duration-200"
                />
                {taken && (
                  <rect
                    x={zone.rect.x + 3}
                    y={zone.rect.y + 3}
                    width={zone.rect.w - 6}
                    height={zone.rect.h - 6}
                    rx={12}
                    fill={`url(#${hatchId})`}
                  />
                )}
                <rect
                  x={zone.rect.x + 3}
                  y={zone.rect.y + 3}
                  width={zone.rect.w - 6}
                  height={zone.rect.h - 6}
                  rx={12}
                  fill="none"
                  stroke={isSelected ? tier : '#00000024'}
                  strokeWidth={isSelected ? 3.5 : 1.5}
                  strokeDasharray={taken || isSelected ? undefined : '7 6'}
                  className="transition-all duration-200"
                />
              </g>
            )
          })}
        </g>

        {/* 3 — cleft and gluteal folds, clipped so no stroke runs off the body */}
        <g clipPath={`url(#${clipId})`}>
          <path d={CLEFT_PATH} fill="none" stroke="#00000033" strokeWidth="5" strokeLinecap="round" />
          {FOLD_PATHS.map((d) => (
            <path key={d} d={d} fill="none" stroke="#00000022" strokeWidth="3.5" strokeLinecap="round" />
          ))}
        </g>

        {/* 4 — hit targets and labels */}
        {ZONES.map((zone) => {
          const state = states.get(zone.id)
          const isSelected = selectedId === zone.id
          const tier = TIER_COLOR[zone.tier]
          const price = state?.topBid
            ? formatMoney(state.topBid.amountCents)
            : formatMoney(state?.reserveCents ?? zone.reserveCents)

          return (
            <g
              key={zone.id}
              role="button"
              tabIndex={0}
              aria-label={ariaLabelFor(zone, state)}
              aria-pressed={isSelected}
              className="cursor-pointer outline-none"
              onClick={() => onSelect(zone.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(zone.id)
                }
              }}
              onMouseEnter={() => setHovered(zone.id)}
              onMouseLeave={() => setHovered((h) => (h === zone.id ? null : h))}
              onFocus={() => setHovered(zone.id)}
              onBlur={() => setHovered((h) => (h === zone.id ? null : h))}
            >
              {/* Invisible, generous hit area covering the whole zone. */}
              <rect
                x={zone.rect.x}
                y={zone.rect.y}
                width={zone.rect.w}
                height={zone.rect.h}
                fill="transparent"
              />

              {/* Halo strokes keep the text legible over any fill underneath. */}
              <text
                x={zone.anchor.x}
                y={zone.anchor.y - 9}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                letterSpacing="0.5"
                fill="#000"
                stroke="#fff"
                strokeWidth="4"
                paintOrder="stroke"
                className="pointer-events-none"
              >
                {shortLabel(zone)}
              </text>
              <text
                x={zone.anchor.x}
                y={zone.anchor.y + 16}
                textAnchor="middle"
                fontSize="23"
                fontWeight="700"
                letterSpacing="-0.5"
                fill={state?.topBid ? tier : '#000'}
                stroke="#fff"
                strokeWidth="4.5"
                paintOrder="stroke"
                className="pointer-events-none"
              >
                {price}
              </text>
              {/* The Ravine is 64 units wide and this label is not. Zones
                  narrower than the label simply do without it. */}
              {!state?.topBid && zone.rect.w >= 100 && (
                <text
                  x={zone.anchor.x}
                  y={zone.anchor.y + 31}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  letterSpacing="1"
                  fill="#99948f"
                  stroke="#fff"
                  strokeWidth="3"
                  paintOrder="stroke"
                  className="pointer-events-none"
                >
                  NO BIDS YET
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <p className="mt-2 text-center text-[13px] text-muted">
        Tap a placement. Yes, all of them are real. Yes, including that one.
      </p>
    </div>
  )
}

function ariaLabelFor(zone: Zone, state: ZoneAuctionState | undefined): string {
  const price = state?.topBid
    ? `current top bid ${formatMoney(state.topBid.amountCents)} by ${state.topBid.sponsorName}`
    : `no bids yet, opening price ${formatMoney(state?.reserveCents ?? zone.reserveCents)}`
  const closed = state?.closed ? ', closed' : ''
  return `${zone.name}, ${zone.size}, ${price}${closed}`
}
