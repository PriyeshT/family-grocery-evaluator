import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matchPromotionsToList } from '@/tools/match-promotions'
import type { FairPricePromotion, ShoppingListItem } from '@/types'

// vi.hoisted ensures mockCreate is available inside the vi.mock factory (which is hoisted above imports)
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

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

const item = (term: string, preferredBrand?: string): ShoppingListItem => ({ term, preferredBrand })

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

// Default: LLM throws — all tests that don't override this exercise the fuzzy fallback path
beforeEach(() => {
  mockCreate.mockReset()
  mockCreate.mockRejectedValue(new Error('LLM unavailable'))
})

describe('matchPromotionsToList — existing matching paths', () => {
  it('exact match — term is a substring of promotion name', async () => {
    const { matched } = await matchPromotionsToList([item('milk')], promotions)
    expect(matched).toHaveLength(1)
    expect(matched[0].matchMethod).toBe('exact')
    expect(matched[0].confidence).toBe(1)
    expect(matched[0].shoppingListTerm).toBe('milk')
  })

  it('exact match is case-insensitive', async () => {
    const { matched } = await matchPromotionsToList([item('EGGS')], promotions)
    expect(matched).toHaveLength(1)
    expect(matched[0].matchMethod).toBe('exact')
  })

  it('fuzzy match — LLM fails, falls back to token-overlap scoring', async () => {
    // "bread loaf" is not a substring of any name, but "bread" token overlaps → fuzzy score 0.5 ≥ threshold
    const { matched } = await matchPromotionsToList([item('bread loaf')], promotions)
    expect(matched).toHaveLength(1)
    expect(matched[0].matchMethod).toBe('fuzzy')
    expect(matched[0].promotion.name).toContain('Bread')
  })

  it('unmatched — LLM fails and no fuzzy match above threshold', async () => {
    const { matched, unmatched } = await matchPromotionsToList([item('truffles')], promotions)
    expect(matched).toHaveLength(0)
    expect(unmatched).toContain('truffles')
  })

  it('no false positives — low-overlap term stays unmatched', async () => {
    const { unmatched } = await matchPromotionsToList([item('xyz_no_match')], promotions)
    expect(unmatched).toContain('xyz_no_match')
  })

  it('picks the promotion with highest saving % when multiple exact matches', async () => {
    const lowSaving = makePromotion('Fresh Chicken Drumsticks 500g', 10)
    const highSaving = makePromotion('Fresh Chicken Wings 500g', 30)
    const { matched } = await matchPromotionsToList([item('chicken')], [lowSaving, highSaving])
    expect(matched[0].promotion.savingPct).toBe(30)
  })

  it('handles a promotion with null savingPct in best-pick logic', async () => {
    const withSaving = makePromotion('Full Cream Milk 1L', 20)
    const noSaving = makePromotion('Fresh Milk 2L', null)
    const { matched } = await matchPromotionsToList([item('milk')], [noSaving, withSaving])
    expect(matched[0].promotion.savingPct).toBe(20)
  })

  it('surfaces all matched terms and all unmatched terms correctly', async () => {
    const { matched, unmatched } = await matchPromotionsToList(
      [item('milk'), item('eggs'), item('truffles')],
      promotions,
    )
    expect(matched.map((m) => m.shoppingListTerm)).toContain('milk')
    expect(matched.map((m) => m.shoppingListTerm)).toContain('eggs')
    expect(unmatched).toContain('truffles')
  })

  it('returns empty matched and full unmatched for empty promotions list', async () => {
    const { matched, unmatched } = await matchPromotionsToList([item('milk'), item('eggs')], [])
    expect(matched).toHaveLength(0)
    expect(unmatched).toEqual(['milk', 'eggs'])
  })

  it('returns empty matched and empty unmatched for empty shopping list', async () => {
    const { matched, unmatched } = await matchPromotionsToList([], promotions)
    expect(matched).toHaveLength(0)
    expect(unmatched).toHaveLength(0)
  })

  it('attaches full promotion details to each matched item', async () => {
    const { matched } = await matchPromotionsToList([item('butter')], promotions)
    expect(matched[0].promotion.name).toBe('Anchor Butter Salted 250g')
    expect(matched[0].promotion.salePrice).toBe(3.0)
    expect(matched[0].promotion.savingPct).toBe(15)
  })
})

describe('matchPromotionsToList — LLM semantic matching', () => {
  const oilPromos: FairPricePromotion[] = [
    makePromotion('Knife Vegetable Oil 2L', 20),
    makePromotion('Fortune Palm Oil 2L', 10),
  ]

  it('exact brand match via LLM — brandFound true, matchMethod llm', async () => {
    // "cooking oil" is not a substring of "Knife Vegetable Oil 2L" — requires semantic reasoning → LLM path
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'submit_match',
          input: { bestMatchIndex: 0, brandFound: true, alternatives: [] },
        },
      ],
    })

    const { matched } = await matchPromotionsToList([item('cooking oil', 'Knife')], oilPromos)
    expect(matched).toHaveLength(1)
    expect(matched[0].matchMethod).toBe('llm')
    expect(matched[0].brandFound).toBe(true)
    expect(matched[0].promotion.name).toBe('Knife Vegetable Oil 2L')
    expect(matched[0].confidence).toBe(1)
  })

  it('preferred brand not found — LLM returns alternative, brandFound false', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'submit_match',
          input: {
            bestMatchIndex: 1,
            brandFound: false,
            alternatives: [{ index: 0, reason: 'Knife as alternative brand' }],
          },
        },
      ],
    })

    const { matched } = await matchPromotionsToList([item('cooking oil', 'Farmhouse')], oilPromos)
    expect(matched).toHaveLength(1)
    expect(matched[0].matchMethod).toBe('llm')
    expect(matched[0].brandFound).toBe(false)
    expect(matched[0].promotion.name).toBe('Fortune Palm Oil 2L')
    expect(matched[0].alternatives).toHaveLength(1)
    expect(matched[0].alternatives![0].name).toBe('Knife Vegetable Oil 2L')
    expect(matched[0].confidence).toBe(0.8)
  })

  it('LLM returns no match (bestMatchIndex -1) — item is unmatched', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'submit_match',
          input: { bestMatchIndex: -1, brandFound: false, alternatives: [] },
        },
      ],
    })

    const { matched, unmatched } = await matchPromotionsToList([item('truffles')], oilPromos)
    expect(matched).toHaveLength(0)
    expect(unmatched).toContain('truffles')
  })
})
