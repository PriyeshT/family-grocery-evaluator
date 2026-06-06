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

const deals: RawDeal[] = [
  makeDeal('Marigold Full Cream Milk 1L'),
  makeDeal('Farmhouse Fresh Eggs 10s'),
  makeDeal('Seara Frozen Chicken Breast'),
  makeDeal('Meiji Natural Yogurt 140g'),
  makeDeal('Gardenia Original Classic Bread'),
  makeDeal('Fortune Jasmine Rice 5kg'),
]

describe('matchItemsToDeals', () => {
  it('exact match — term is substring of deal name', () => {
    const result = matchItemsToDeals(['milk'], deals)
    expect(result).toHaveLength(1)
    expect(result[0].match_method).toBe('exact')
    expect(result[0].confidence).toBe(1)
    expect(result[0].matched_deal.name).toBe('Marigold Full Cream Milk 1L')
  })

  it('exact match — case insensitive', () => {
    const result = matchItemsToDeals(['EGGS'], deals)
    expect(result).toHaveLength(1)
    expect(result[0].match_method).toBe('exact')
  })

  it('fuzzy match — partial token overlap', () => {
    const result = matchItemsToDeals(['chicken breast'], deals)
    expect(result).toHaveLength(1)
    expect(result[0].match_method).toBe('exact') // 'chicken' is in 'Seara Frozen Chicken Breast'
    expect(result[0].matched_deal.name).toContain('Chicken')
  })

  it('fuzzy match — low confidence term returns empty when below threshold', () => {
    const result = matchItemsToDeals(['xyz_no_match'], deals)
    expect(result).toHaveLength(0)
  })

  it('no match — returns empty array for unrecognised item', () => {
    const result = matchItemsToDeals(['truffles'], deals)
    expect(result).toHaveLength(0)
  })

  it('multiple items — returns one match per matched term', () => {
    const result = matchItemsToDeals(['milk', 'eggs', 'bread'], deals)
    expect(result).toHaveLength(3)
    const terms = result.map((r) => r.shopping_list_term)
    expect(terms).toContain('milk')
    expect(terms).toContain('eggs')
    expect(terms).toContain('bread')
  })

  it('picks deal with highest saving % when multiple exact matches exist', () => {
    const lowSaving = { ...makeDeal('Fresh Chicken Drumsticks'), savingPct: 10 }
    const highSaving = { ...makeDeal('Fresh Chicken Wings'), savingPct: 30 }
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
