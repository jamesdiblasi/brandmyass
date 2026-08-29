import type { SponsorHistoryEntry } from '@/lib/auction'

/**
 * The scrolling wall of everyone who has ever been on the ass.
 *
 * Pure CSS: the track holds the sponsor list twice and slides by exactly half
 * its own width, so the loop point is invisible. Sponsors are deduped by name —
 * a company that bought three placements is one logo here, not three — and a
 * sponsor with no logo scrolls by as a wordmark pill rather than being
 * skipped, because they paid like everyone else.
 *
 * Renders nothing until somebody has actually bought a slot. An empty marquee
 * is just a stripe of silence.
 */
export function LogoMarquee({ history }: { history: SponsorHistoryEntry[] }) {
  const seen = new Set<string>()
  const sponsors = history.filter((h) => {
    const key = h.sponsorName.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (sponsors.length === 0) return null

  const Track = ({ hidden = false }: { hidden?: boolean }) => (
    <div className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {sponsors.map((s) => (
        <span key={`${hidden ? 'b' : 'a'}-${s.sponsorName}`} className="flex items-center">
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.logoUrl}
              alt={hidden ? '' : s.sponsorName}
              className="h-8 w-auto max-w-[140px] object-contain opacity-80"
            />
          ) : (
            <span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] text-muted">
              {s.sponsorName}
            </span>
          )}
        </span>
      ))}
    </div>
  )

  return (
    <div className="border-y border-hairline2/60 bg-white/60 py-4">
      <p className="eyebrow mb-3 text-center">The temporary owners</p>
      <div className="marquee" role="marquee" aria-label="Companies that have sponsored a placement">
        <div className="marquee__track">
          <Track />
          <Track hidden />
        </div>
      </div>
    </div>
  )
}
