import { describe, expect, it } from 'vitest'
import { formatMoney, parseMoneyToCents } from './money'

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
