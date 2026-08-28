'use client'

import { useEffect, useState } from 'react'

/**
 * Counts down to `to`, ticking every second.
 *
 * Renders nothing on the server and on the first client paint — the remaining
 * time is by definition different between the two, and letting React reconcile
 * that mismatch produces a hydration error on every page load.
 */
export function Countdown({ to, className = '' }: { to: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (now === null) return <span className={className}>—</span>

  const ms = new Date(to).getTime() - now
  if (ms <= 0) return <span className={className}>CLOSED</span>

  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60

  const parts = d > 0 ? [`${d}d`, `${h}h`, `${m}m`] : [`${h}h`, `${m}m`, `${String(sec).padStart(2, '0')}s`]

  return (
    <span className={className} suppressHydrationWarning>
      {parts.join(' ')}
    </span>
  )
}

/** True once the given instant is within `windowMs` — drives the panic styling. */
export function useIsClosingSoon(to: string, windowMs: number): boolean {
  const [soon, setSoon] = useState(false)
  useEffect(() => {
    const check = () => setSoon(new Date(to).getTime() - Date.now() <= windowMs)
    check()
    const id = setInterval(check, 1000)
    return () => clearInterval(id)
  }, [to, windowMs])
  return soon
}
