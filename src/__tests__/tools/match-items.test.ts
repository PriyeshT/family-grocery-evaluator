import { describe, it, expect } from 'vitest'
import { matchItemsToDeals, getUnmatched } from '@/tools/match-items'
import type { RawDeal } from '@/types'

const makeDeal = (name: string, store: 'fairprice' | 'coldstorage' = 'fairprice'): RawDeal => ({
  name,
  store,
  salePrice: 3.0,
  originalPrice: 4.0,
  savingAmount: 1.0,
  savingPct: 25.0,
  url: null,
  promoLabel: null,
})

// One FairPrice deal and one Cold Storage deal for each item
const deals: RawDeal[] = [
  makeDeal('Marigold Full Cream Milk 1L', 'fairprice'),
  makeDeal('Greenfields Fresh Milk 1L', 'coldstorage'),
  makeDeal('Farmhouse Fresh Eggs 10s', 'fairprice'),
  makeDeal('Happy Eggs Free Range 10pc', 'coldstorage'),
  makeDeal('Seara Frozen Chicken Breast', 'fairprice'),
  makeDeal('Tyson Fresh Chicken Fillet', 'coldstorage'),
  makeDeal('Gardenia Original Classic Bread', 'fairprice'),
  makeDeal('Fortune Jasmine Rice 5kg', 'fairprice'),
]

describe('matchItemsToDeals', () => {
  it('returns one match per store when both stores have the item', () => {
    const result = matchItemsToDeals(['milk'], deals)
    expect(result).toHaveLength(2)
    const stores = result.map((r) => r.matched_deal.store)
    expect(stores).toContain('fairprice')
    expect(stores).toContain('coldstorage')
  })

  it('returns one match when only one store has the item', () => {
    const result = matchItemsToDeals(['bread'], deals)
    expect(result).toHaveLength(1)
    expect(result[0].matched_deal.store).toBe('fairprice')
  })

  it('exact match — term is substring of deal name', () => {
    const result = matchItemsToDeals(['milk'], deals)
    expect(result.every((r) => r.match_method === 'exact')).toBe(true)
    expect(result.every((r) => r.confidence === 1)).toBe(true)
  })

  it('exact match — case insensitive', () => {
    const result = matchItemsToDeals(['EGGS'], deals)
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((r) => r.match_method === 'exact')).toBe(true)
  })

  it('fuzzy match — partial token overlap', () => {
    const result = matchItemsToDeals(['chicken breast'], deals)
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((r) => r.matched_deal.name.toLowerCase().includes('chicken'))).toBe(true)
  })

  it('no match — returns empty array for unrecognised item', () => {
    const result = matchItemsToDeals(['truffles'], deals)
    expect(result).toHaveLength(0)
  })

  it('fuzzy match — low confidence term returns empty when below threshold', () => {
    const result = matchItemsToDeals(['xyz_no_match'], deals)
    expect(result).toHaveLength(0)
  })

  it('multiple items — returns matches across both stores', () => {
    const result = matchItemsToDeals(['milk', 'eggs'], deals)
    const terms = result.map((r) => r.shopping_list_term)
    expect(terms).toContain('milk')
    expect(terms).toContain('eggs')
  })

  it('picks deal with highest saving % per store when multiple exact matches exist', () => {
    const lowSaving = { ...makeDeal('Fresh Chicken Drumsticks', 'fairprice'), savingPct: 10 }
    const highSaving = { ...makeDeal('Fresh Chicken Wings', 'fairprice'), savingPct: 30 }
    const result = matchItemsToDeals(['chicken'], [lowSaving, highSaving])
    expect(result[0].matched_deal.savingPct).toBe(30)
  })
})

describe('getUnmatched', () => {
  it('returns items with no match', () => {
    const matched = matchItemsToDeals(['milk', 'truffles'], deals)
    const unmatched = getUnmatched(['milk', 'truffles'], matched)
    expect(unmatched).toEqual(['truffles'])
  })

  it('returns empty array when all items matched', () => {
    const matched = matchItemsToDeals(['milk', 'eggs'], deals)
    const unmatched = getUnmatched(['milk', 'eggs'], matched)
    expect(unmatched).toHaveLength(0)
  })
})
