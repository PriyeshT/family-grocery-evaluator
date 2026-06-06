import { describe, it, expect } from 'vitest'
import { matchPromotionsToList } from '@/tools/match-promotions'
import type { FairPricePromotion, ShoppingListItem } from '@/types'

function makePromotion(name: string, savingPct: number | null = 15): FairPricePromotion {
  return {
    name,
    salePrice: 3.0,
    originalPrice: savingPct !== null ? 3.5 : null,
    savingAmount: savingPct !== null ? 0.5 : null,
    savingPct,
    promoLabel: savingPct !== null ? `Save $0.50` : null,
    category: null,
    imageUrl: null,
    url: null,
    validUntil: null,
  }
}

const item = (term: string): ShoppingListItem => ({ term })

const promotions: FairPricePromotion[] = [
  makePromotion('Marigold UHT Milk Full Cream 1L'),
  makePromotion("Farmhouse Fresh Eggs 10's"),
  makePromotion('Seara Frozen Chicken Breast Boneless'),
  makePromotion('Meiji Natural Yogurt 140g'),
  makePromotion('Gardenia Original Classic Bread 400g'),
  makePromotion('Anchor Butter Salted 250g'),
  makePromotion('Fortune Fragrant Rice 5kg'),
  makePromotion('Knife Cooking Oil 2L'),
  makePromotion('Chef Red Onion Large 500g'),
  makePromotion('Barilla Spaghetti Pasta 500g'),
]

describe('matchPromotionsToList', () => {
  it('exact match — term is a substring of promotion name', () => {
    const { matched } = matchPromotionsToList([item('milk')], promotions)
    expect(matched).toHaveLength(1)
    expect(matched[0].matchMethod).toBe('exact')
    expect(matched[0].confidence).toBe(1)
    expect(matched[0].shoppingListTerm).toBe('milk')
  })

  it('exact match is case-insensitive', () => {
    const { matched } = matchPromotionsToList([item('EGGS')], promotions)
    expect(matched).toHaveLength(1)
    expect(matched[0].matchMethod).toBe('exact')
  })

  it('fuzzy match — partial token overlap above threshold', () => {
    // "bread loaf" is not a substring of any name, but "bread" token overlaps → score 0.5 ≥ threshold
    const { matched } = matchPromotionsToList([item('bread loaf')], promotions)
    expect(matched).toHaveLength(1)
    expect(matched[0].matchMethod).toBe('fuzzy')
    expect(matched[0].promotion.name).toContain('Bread')
  })

  it('unmatched — returns term when no promotion matches', () => {
    const { matched, unmatched } = matchPromotionsToList([item('truffles')], promotions)
    expect(matched).toHaveLength(0)
    expect(unmatched).toContain('truffles')
  })

  it('no false positives — low-overlap term stays unmatched', () => {
    const { unmatched } = matchPromotionsToList([item('xyz_no_match')], promotions)
    expect(unmatched).toContain('xyz_no_match')
  })

  it('picks the promotion with highest saving % when multiple exact matches', () => {
    const lowSaving = makePromotion('Fresh Chicken Drumsticks 500g', 10)
    const highSaving = makePromotion('Fresh Chicken Wings 500g', 30)
    const { matched } = matchPromotionsToList([item('chicken')], [lowSaving, highSaving])
    expect(matched[0].promotion.savingPct).toBe(30)
  })

  it('handles a promotion with null savingPct in best-pick logic', () => {
    const withSaving = makePromotion('Full Cream Milk 1L', 20)
    const noSaving = makePromotion('Fresh Milk 2L', null)
    const { matched } = matchPromotionsToList([item('milk')], [noSaving, withSaving])
    expect(matched[0].promotion.savingPct).toBe(20)
  })

  it('surfaces all matched terms and all unmatched terms correctly', () => {
    const { matched, unmatched } = matchPromotionsToList([item('milk'), item('eggs'), item('truffles')], promotions)
    expect(matched.map((m) => m.shoppingListTerm)).toContain('milk')
    expect(matched.map((m) => m.shoppingListTerm)).toContain('eggs')
    expect(unmatched).toContain('truffles')
  })

  it('returns empty matched and full unmatched for empty promotions list', () => {
    const { matched, unmatched } = matchPromotionsToList([item('milk'), item('eggs')], [])
    expect(matched).toHaveLength(0)
    expect(unmatched).toEqual(['milk', 'eggs'])
  })

  it('returns empty matched and empty unmatched for empty shopping list', () => {
    const { matched, unmatched } = matchPromotionsToList([], promotions)
    expect(matched).toHaveLength(0)
    expect(unmatched).toHaveLength(0)
  })

  it('attaches full promotion details to each matched item', () => {
    const { matched } = matchPromotionsToList([item('butter')], promotions)
    expect(matched[0].promotion.name).toBe('Anchor Butter Salted 250g')
    expect(matched[0].promotion.salePrice).toBe(3.0)
    expect(matched[0].promotion.savingPct).toBe(15)
  })
})
