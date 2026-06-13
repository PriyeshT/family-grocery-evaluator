import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FairPricePromotion } from '@/types'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGenerateText = vi.hoisted(() => vi.fn())
const mockHandleScrapeSection = vi.hoisted(() => vi.fn())

// Suppress module-level `new Anthropic()` in match-promotions.ts
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: vi.fn() }
  },
}))

// tool() is a passthrough — mock it as identity so execute is accessible on the tools object
vi.mock('ai', () => ({
  generateText: mockGenerateText,
  tool: (config: unknown) => config,
  stepCountIs: (n: number) => n,
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: () => (_modelId: string) => ({ id: _modelId }),
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

const testShoppingList = [{ term: 'milk', preferredBrand: 'Greenfields' }]

const recordArgs = {
  matched: [
    {
      shopping_list_term: 'milk',
      promotion_name: 'Marigold Full Cream Milk 1L',
      sale_price: 2.55,
      original_price: 3.2,
      saving_amount: 0.65,
      saving_pct: 20.3,
      confidence: 1,
      match_method: 'exact' as const,
    },
  ],
  alternatives: [],
  unmatched: [],
  savings_summary: 'Total savings: $0.65',
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

import { runGroceryAgent } from '@/agents/grocery-agent'
import { traceStore } from '@/trace/store'

const mockSteps = [
  {
    text: 'I will scrape fresh-picks first.',
    toolCalls: [{ toolName: 'scrape_fairprice_section', toolCallId: '1', type: 'tool-call', args: {} }],
    toolResults: [],
    usage: { inputTokens: 100, outputTokens: 40 },
    finishReason: 'tool-calls',
  },
  {
    text: '',
    toolCalls: [{ toolName: 'match_items', toolCallId: '2', type: 'tool-call', args: {} }],
    toolResults: [],
    usage: { inputTokens: 200, outputTokens: 30 },
    finishReason: 'tool-calls',
  },
  {
    text: '',
    toolCalls: [{ toolName: 'record_recommendation', toolCallId: '3', type: 'tool-call', args: {} }],
    toolResults: [],
    usage: { inputTokens: 300, outputTokens: 20 },
    finishReason: 'stop',
  },
]

// Simulate the agentic loop: generateText calls execute functions in sequence,
// which is how the real SDK drives the loop — tools run as Claude calls them.
function makeGenerateTextMock(fallback = false) {
  return async ({ tools }: { tools: Record<string, { execute: Function }> }) => {
    const scrapeResult = await tools.scrape_fairprice_section.execute({ section: 'fresh-picks' })
    await tools.match_items.execute({
      shopping_list: testShoppingList,
      promotions: scrapeResult.promotions,
    })
    await tools.record_recommendation.execute(
      fallback ? { ...recordArgs, matched: [{ ...recordArgs.matched[0] }] } : recordArgs
    )
    return { steps: mockSteps, text: '', finishReason: 'stop' }
  }
}

describe('runGroceryAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHandleScrapeSection.mockResolvedValue(scrapeHandlerResult)
    mockGenerateText.mockImplementation(makeGenerateTextMock())
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
    mockGenerateText.mockImplementation(makeGenerateTextMock(true))
    const { usingDemoData } = await runGroceryAgent('manual', testShoppingList)
    expect(usingDemoData).toBe(true)
  })

  it('trace scrape step reflects fallback status', async () => {
    mockHandleScrapeSection.mockResolvedValue(scrapeHandlerFallbackResult)
    mockGenerateText.mockImplementation(makeGenerateTextMock(true))
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
    mockGenerateText.mockImplementation(makeGenerateTextMock(true))
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

  it('uses stopWhen with stepCountIs guard', async () => {
    await runGroceryAgent('manual', testShoppingList)
    const callArgs = mockGenerateText.mock.calls[0][0]
    expect(callArgs.stopWhen).toBeDefined()
  })

  it('trace llm_steps is populated from generateText steps', async () => {
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    expect(trace.llm_steps).toHaveLength(3)
    expect(trace.llm_steps[0].step_number).toBe(0)
    expect(trace.llm_steps[0].tool_called).toBe('scrape_fairprice_section')
    expect(trace.llm_steps[0].reasoning).toBe('I will scrape fresh-picks first.')
    expect(trace.llm_steps[1].tool_called).toBe('match_items')
    expect(trace.llm_steps[2].tool_called).toBe('record_recommendation')
  })

  it('trace llm_steps captures token counts per step', async () => {
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    expect(trace.llm_steps[0].input_tokens).toBe(100)
    expect(trace.llm_steps[0].output_tokens).toBe(40)
  })

  it('trace total_input_tokens and total_output_tokens are summed', async () => {
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    expect(trace.total_input_tokens).toBe(600)
    expect(trace.total_output_tokens).toBe(90)
  })

  it('trace tool_calls records every tool invocation', async () => {
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    const toolNames = trace.tool_calls.map((tc) => tc.tool)
    expect(toolNames).toContain('scrape_fairprice_section')
    expect(toolNames).toContain('match_items')
    expect(toolNames).toContain('record_recommendation')
  })

  it('trace tool_calls includes input and duration_ms', async () => {
    const { trace } = await runGroceryAgent('manual', testShoppingList)
    const scrapeCall = trace.tool_calls.find((tc) => tc.tool === 'scrape_fairprice_section')
    expect(scrapeCall?.input).toEqual({ section: 'fresh-picks' })
    expect(scrapeCall?.duration_ms).toBeGreaterThanOrEqual(0)
  })
})
