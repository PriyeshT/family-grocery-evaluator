import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FairPricePromotion } from '@/types'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockCreate = vi.hoisted(() => vi.fn())
const mockHandleScrapeSection = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

vi.mock('@/agents/tools', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/agents/tools')>()
  return { ...actual, handleScrapeSection: mockHandleScrapeSection }
})

vi.mock('@/trace/store', () => ({
  traceStore: { save: vi.fn(), getLatest: vi.fn(), getAll: vi.fn() },
}))

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const testPromotion: FairPricePromotion = {
  name: 'Marigold Full Cream Milk 1L',
  salePrice: 2.55,
  originalPrice: 3.2,
  savingAmount: 0.65,
  savingPct: 20.3,
  promoLabel: 'Save $0.65',
  category: 'fresh-picks',
  imageUrl: null,
  url: null,
  validUntil: null,
}

const scrapeHandlerResult = {
  promotions: [testPromotion],
  count: 1,
  usedFallback: false,
  scrapedAt: '2026-06-09T00:00:00.000Z',
}

const scrapeHandlerFallbackResult = {
  promotions: [testPromotion],
  count: 1,
  usedFallback: true,
  scrapedAt: '2026-06-09T00:00:00.000Z',
  error: 'mock fallback',
}

function makeToolUseResponse(
  id: string,
  toolName: string,
  toolId: string,
  input: unknown
) {
  return {
    id,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'tool_use', id: toolId, name: toolName, input }],
    stop_reason: 'tool_use',
    model: AGENT_MODEL,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  }
}

const AGENT_MODEL = 'claude-haiku-4-5-20251001'

const testShoppingList = [{ term: 'milk', preferredBrand: 'Greenfields' }]

const scrapeResponse = makeToolUseResponse('msg_1', 'scrape_fairprice_section', 'toolu_1', {
  section: 'fresh-picks',
})

const matchResponse = makeToolUseResponse('msg_2', 'match_items', 'toolu_2', {
  shopping_list: testShoppingList,
  promotions: [testPromotion],
})

const recordResponse = makeToolUseResponse('msg_3', 'record_recommendation', 'toolu_3', {
  matched: [
    {
      shopping_list_term: 'milk',
      promotion_name: 'Marigold Full Cream Milk 1L',
      sale_price: 2.55,
      original_price: 3.2,
      saving_amount: 0.65,
      saving_pct: 20.3,
      confidence: 1,
      match_method: 'exact',
    },
  ],
  alternatives: [],
  unmatched: [],
  savings_summary: 'Total savings: $0.65',
})

// ─── Tests ──────────────────────────────────────────────────────────────────────

import { runGroceryAgent } from '@/agents/grocery-agent'
import { traceStore } from '@/trace/store'

describe('runGroceryAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHandleScrapeSection.mockResolvedValue(scrapeHandlerResult)
    mockCreate
      .mockResolvedValueOnce(scrapeResponse)
      .mockResolvedValueOnce(matchResponse)
      .mockResolvedValueOnce(recordResponse)
  })

  it('returns a plan and trace', async () => {
    const result = await runGroceryAgent('manual', testShoppingList)
    expect(result.plan).toBeDefined()
    expect(result.trace).toBeDefined()
  })

  it('trace has scrape and matching steps populated', async () => {
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    expect(trace.steps.scrape).not.toBeNull()
    expect(trace.steps.matching).not.toBeNull()
  })

  it('trace run_id matches plan run_id', async () => {
    const { plan, trace } = await runGroceryAgent('manual', testShoppingList)
    expect(plan.run_id).toBe(trace.run_id)
  })

  it('sections_selected is recorded in scrape trace', async () => {
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    expect(trace.steps.scrape?.fairprice.sections_selected).toEqual(['fresh-picks'])
  })

  it('section_results is recorded with correct shape', async () => {
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    const sr = trace.steps.scrape?.fairprice.section_results
    expect(sr).toHaveLength(1)
    expect(sr?.[0].section).toBe('fresh-picks')
    expect(sr?.[0].items_found).toBe(1)
    expect(sr?.[0].status).toBe('success')
  })

  it('usingDemoData is false when scraper succeeds', async () => {
    const { usingDemoData } = await runGroceryAgent('manual', testShoppingList)
    expect(usingDemoData).toBe(false)
  })

  it('usingDemoData is true when scraper uses fallback', async () => {
    mockHandleScrapeSection.mockResolvedValue(scrapeHandlerFallbackResult)
    const { usingDemoData } = await runGroceryAgent('manual', testShoppingList)
    expect(usingDemoData).toBe(true)
  })

  it('trace scrape step reflects fallback status', async () => {
    mockHandleScrapeSection.mockResolvedValue(scrapeHandlerFallbackResult)
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    expect(trace.steps.scrape?.fairprice.status).toBe('fallback_used')
  })

  it('saves trace to store', async () => {
    await runGroceryAgent('manual', testShoppingList)
    expect(traceStore.save).toHaveBeenCalledOnce()
  })

  it('plan has estimated_total and estimated_savings', async () => {
    const { plan } = await runGroceryAgent('manual', testShoppingList)
    expect(plan.estimated_total).toBeGreaterThan(0)
    expect(plan.estimated_savings).toBeGreaterThanOrEqual(0)
  })

  it('trace duration_ms is non-negative', async () => {
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    expect(trace.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('scrape errors are recorded in trace when fallback used', async () => {
    mockHandleScrapeSection.mockResolvedValue(scrapeHandlerFallbackResult)
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    expect(trace.errors.length).toBeGreaterThan(0)
  })

  it('plan matched items match what Claude recorded in recommendation', async () => {
    const { plan } = await runGroceryAgent('manual', testShoppingList)
    expect(plan.items).toHaveLength(1)
    expect(plan.items[0].shopping_list_term).toBe('milk')
    expect(plan.items[0].deal.salePrice).toBe(2.55)
  })

  it('only scrapes the section Claude chose, not all sections', async () => {
    await runGroceryAgent('manual', testShoppingList)
    expect(mockHandleScrapeSection).toHaveBeenCalledOnce()
    expect(mockHandleScrapeSection).toHaveBeenCalledWith({ section: 'fresh-picks' })
  })
})
