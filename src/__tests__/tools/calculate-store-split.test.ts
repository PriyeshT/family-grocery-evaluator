import { describe, it, expect } from 'vitest'
import { calculateStoreSplit } from '@/tools/calculate-store-split'
import type { ComparedItem } from '@/trace/types'
import type { RawDeal } from '@/types'
import { config } from '@/lib/config'

const deal = (name: string, store: 'fairprice' | 'coldstorage', price: number): RawDeal => ({
  name,
  store,
  salePrice: price,
  originalPrice: price + 2,
  savingAmount: 2,
  savingPct: 10,
  url: null,
  promoLabel: null,
})

const compared = (
  name: string,
  fpPrice: number | null,
  csPrice: number | null,
  winner: 'fairprice' | 'coldstorage',
  saving: number
): ComparedItem => ({
  item_name: name,
  fairprice_deal: fpPrice !== null ? deal(`FP ${name}`, 'fairprice', fpPrice) : null,
  coldstorage_deal: csPrice !== null ? deal(`CS ${name}`, 'coldstorage', csPrice) : null,
  winner,
  saving_amount: saving,
  saving_pct: saving > 0 ? parseFloat(((saving / Math.max(fpPrice ?? 0, csPrice ?? 0)) * 100).toFixed(1)) : 0,
})

describe('calculateStoreSplit', () => {
  it('recommends single store when savings below threshold', () => {
    const items: ComparedItem[] = [
      compared('milk', 2.0, 2.5, 'fairprice', 0.5),
      compared('eggs', 3.0, 3.8, 'fairprice', 0.8),
    ]
    // total = 1.3, threshold = 2.0 → single store
    const result = calculateStoreSplit(items, config)
    expect(result.recommendation).toBe('single_store')
    expect(result.split_store).toBeNull()
    expect(result.estimated_total_savings).toBe(1.3)
  })

  it('recommends split when savings meet threshold and items split across stores', () => {
    const items: ComparedItem[] = [
      compared('milk', 2.0, 3.5, 'fairprice', 1.5),
      compared('chicken', 11.0, 8.0, 'coldstorage', 3.0),
    ]
    // total = 4.5 >= 2.0, FP wins milk, CS wins chicken → genuine split
    const result = calculateStoreSplit(items, config)
    expect(result.recommendation).toBe('split')
    expect(result.split_store).not.toBeNull()
    expect(result.estimated_total_savings).toBe(4.5)
    expect(result.reasoning).toContain('milk')
    expect(result.reasoning).toContain('chicken')
  })

  it('recommends single store when savings exceed threshold but one store wins all items', () => {
    const items: ComparedItem[] = [
      compared('milk', 2.0, 3.5, 'fairprice', 1.5),
      compared('chicken', 8.0, 11.0, 'fairprice', 3.0),
    ]
    // total = 4.5 >= 2.0 but FP wins everything — no point splitting
    const result = calculateStoreSplit(items, config)
    expect(result.recommendation).toBe('single_store')
    expect(result.primary_store).toBe('fairprice')
    expect(result.split_store).toBeNull()
    expect(result.estimated_total_savings).toBe(4.5)
  })

  it('recommends single store when only one store has items', () => {
    const items: ComparedItem[] = [
      compared('butter', 5.0, null, 'fairprice', 0),
      compared('rice', 11.0, null, 'fairprice', 0),
    ]
    const result = calculateStoreSplit(items, config)
    expect(result.recommendation).toBe('single_store')
    expect(result.reasoning).toContain('only available at one store')
  })

  it('threshold is recorded in result', () => {
    const items: ComparedItem[] = [compared('milk', 2.0, 2.5, 'fairprice', 0.5)]
    const result = calculateStoreSplit(items, config)
    expect(result.threshold_applied).toBe(config.storeSplitSavingsThreshold)
  })

  it('reasoning is a non-empty string', () => {
    const items: ComparedItem[] = [compared('milk', 2.0, 3.0, 'fairprice', 1.0)]
    const result = calculateStoreSplit(items, config)
    expect(result.reasoning.length).toBeGreaterThan(10)
  })

  it('threshold edge case — exactly at threshold with items split across stores recommends split', () => {
    const items: ComparedItem[] = [
      compared('milk', 2.0, 4.0, 'fairprice', 2.0),
      compared('eggs', 5.0, 3.0, 'coldstorage', 2.0),
    ]
    // total = 4.0 >= 2.0, FP wins milk, CS wins eggs → split
    const result = calculateStoreSplit(items, config)
    expect(result.recommendation).toBe('split')
  })
})
