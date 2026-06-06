import { describe, it, expect } from 'vitest'
import { comparePrices } from '@/tools/compare-prices'
import type { MatchedItem } from '@/trace/types'
import type { RawDeal } from '@/types'

const deal = (name: string, store: 'fairprice' | 'coldstorage', price: number): RawDeal => ({
  name,
  store,
  salePrice: price,
  originalPrice: price + 1,
  savingAmount: 1,
  savingPct: 10,
  url: null,
  promoLabel: null,
})

const matched = (term: string, d: RawDeal): MatchedItem => ({
  shopping_list_term: term,
  matched_deal: d,
  match_method: 'exact',
  confidence: 1,
})

describe('comparePrices', () => {
  it('picks fairprice when cheaper', () => {
    const items: MatchedItem[] = [
      matched('milk', deal('FP Milk', 'fairprice', 2.0)),
      matched('milk', deal('CS Milk', 'coldstorage', 3.0)),
    ]
    const result = comparePrices(items)
    expect(result.items_compared[0].winner).toBe('fairprice')
    expect(result.items_compared[0].saving_amount).toBe(1.0)
  })

  it('picks coldstorage when cheaper', () => {
    const items: MatchedItem[] = [
      matched('eggs', deal('FP Eggs', 'fairprice', 4.0)),
      matched('eggs', deal('CS Eggs', 'coldstorage', 3.5)),
    ]
    const result = comparePrices(items)
    expect(result.items_compared[0].winner).toBe('coldstorage')
  })

  it('marks item as single_store when only one store has it', () => {
    const items: MatchedItem[] = [matched('butter', deal('FP Butter', 'fairprice', 5.0))]
    const result = comparePrices(items)
    expect(result.items_single_store).toContain('butter')
    expect(result.items_compared[0].winner).toBe('fairprice')
    expect(result.items_compared[0].saving_amount).toBe(0)
  })

  it('saving_pct is computed correctly', () => {
    const items: MatchedItem[] = [
      matched('rice', deal('FP Rice', 'fairprice', 10.0)),
      matched('rice', deal('CS Rice', 'coldstorage', 12.0)),
    ]
    const result = comparePrices(items)
    // saving = 2.0, pricier = 12.0, pct = 16.7%
    expect(result.items_compared[0].saving_pct).toBeCloseTo(16.7, 1)
  })

  it('handles empty matched list', () => {
    const result = comparePrices([])
    expect(result.items_compared).toHaveLength(0)
    expect(result.items_single_store).toHaveLength(0)
  })

  it('tie goes to fairprice', () => {
    const items: MatchedItem[] = [
      matched('pasta', deal('FP Pasta', 'fairprice', 3.0)),
      matched('pasta', deal('CS Pasta', 'coldstorage', 3.0)),
    ]
    const result = comparePrices(items)
    expect(result.items_compared[0].winner).toBe('fairprice')
    expect(result.items_compared[0].saving_amount).toBe(0)
  })
})
