import { describe, expect, it } from 'vitest'
import { depositFor, formatMoney, parseMoneyToCents } from './money'
import { MIN_DEPOSIT_CENTS } from './config'

/**
 * These are the functions standing between a bidder and an incorrect charge on
 * their card, so they get tested properly rather than eyeballed.
 */

describe('parseMoneyToCents', () => {
  it('reads plain and decorated amounts', () => {
    expect(parseMoneyToCents('400')).toBe(40_000)
    expect(parseMoneyToCents('$400')).toBe(40_000)
    expect(parseMoneyToCents('1,250')).toBe(125_000)
    expect(parseMoneyToCents(' 666 ')).toBe(66_600)
  })

  it('keeps cents exact, including the ones floats get wrong', () => {
    expect(parseMoneyToCents('0.07')).toBe(7)
    expect(parseMoneyToCents('1.10')).toBe(110)
    expect(parseMoneyToCents('1.1')).toBe(110)
    // 401.15 * 100 is 40114.999... in float arithmetic. String parsing is the
    // whole reason this function exists rather than a Number() call.
    expect(parseMoneyToCents('401.15')).toBe(40_115)
  })

  it('refuses anything it cannot read exactly rather than guessing', () => {
    // Guessing here costs somebody real money, so ambiguity is rejected.
    for (const bad of ['', 'abc', '1.234', '-50', '1e3', '4 0 0', '$', '.5', '1.2.3']) {
      expect(parseMoneyToCents(bad)).toBeNull()
    }
  })
})

describe('depositFor', () => {
  it('takes 20%, rounded up to a whole dollar', () => {
    expect(depositFor(40_000)).toBe(8_000) // $400 -> exactly $80
    // $666 -> $133.20, and a fractional authorisation is not a thing, so up to $134.
    expect(depositFor(66_600)).toBe(13_400)
    expect(depositFor(12_500)).toBe(2_500) // $125 -> exactly $25
  })

  it('never authorises less than the Stripe-friendly floor', () => {
    expect(depositFor(100)).toBe(MIN_DEPOSIT_CENTS)
    expect(depositFor(1)).toBe(MIN_DEPOSIT_CENTS)
  })

  it('always returns whole dollars', () => {
    for (const bid of [12_500, 15_000, 20_000, 30_000, 40_000, 66_600, 123_457]) {
      expect(depositFor(bid) % 100).toBe(0)
    }
  })

  it('is monotonic — a higher bid never holds less', () => {
    let prev = 0
    for (let bid = 1_000; bid < 500_000; bid += 1_337) {
      const d = depositFor(bid)
      expect(d).toBeGreaterThanOrEqual(prev)
      prev = d
    }
  })
})

describe('formatMoney', () => {
  it('drops trailing zeroes on whole dollars and keeps real cents', () => {
    expect(formatMoney(40_000)).toBe('$400')
    expect(formatMoney(66_600)).toBe('$666')
    expect(formatMoney(40_115)).toBe('$401.15')
  })

  it('groups thousands', () => {
    expect(formatMoney(250_000)).toBe('$2,500')
  })
})
