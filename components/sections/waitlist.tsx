'use client'

import { useState } from 'react'

export function Waitlist() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('busy')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? 'That did not work.')
        setState('error')
        return
      }
      setState('done')
    } catch {
      setMessage('Could not reach the server.')
      setState('error')
    }
  }

  return (
    <section className="section">
      <div className="container-dj">
        <div className="rounded-card bg-ink px-6 py-12 text-white sm:px-12 sm:py-16">
          <div className="max-w-2xl">
            <p className="eyebrow text-white/50">Coming next</p>
            <h2 className="mt-3 text-[38px] text-white sm:text-[54px]">
              Want this done to your arse?
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-white/60 sm:text-[19px]">
              I am building the platform so anybody can auction their own. Same live bidding, same anti-snipe
              clock, same card holds, entirely different backside. Leave your email and I will tell you when it is
              ready. No, I will not be applying the tattoos personally.
            </p>

            {state === 'done' ? (
              <div className="mt-8 inline-flex items-center gap-3 rounded-btn bg-lime px-5 py-3.5 text-ink">
                <span aria-hidden className="text-[18px]">✓</span>
                <span className="text-[15.5px] font-semibold">
                  You are on the list. Go and tell somebody about this.
                </span>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="you@company.com"
                  aria-label="Email address"
                  className="w-full rounded-btn border border-white/15 bg-white/10 px-4 py-3.5 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-white/50 sm:max-w-sm"
                />
                <button
                  type="submit"
                  disabled={state === 'busy'}
                  className="btn btn-lg shrink-0 border border-white bg-white text-ink hover:bg-white/90 disabled:opacity-50"
                >
                  {state === 'busy' ? 'One moment…' : 'Tell me when it’s live'}
                </button>
              </form>
            )}

            {state === 'error' && <p className="mt-3 text-[14px] font-medium text-gold">{message}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
