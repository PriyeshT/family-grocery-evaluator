import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScrapeResult } from '@/tools/scrape-fairprice'

// Mock the scraper tools so the agent doesn't hit the network
vi.mock('@/tools/scrape-fairprice', () => ({
  scrapeFairPrice: vi.fn(),
}))
vi.mock('@/tools/scrape-coldstorage', () => ({
  scrapeColdStorage: vi.fn(),
}))
vi.mock('@/trace/store', () => ({
  traceStore: { save: vi.fn(), getLatest: vi.fn(), getAll: vi.fn() },
}))

import { scrapeFairPrice } from '@/tools/scrape-fairprice'
import { scrapeColdStorage } from '@/tools/scrape-coldstorage'
import { traceStore } from '@/trace/store'
import { runGroceryAgent } from '@/agents/grocery-agent'
import type { RawDeal } from '@/types'

const fpDeals: RawDeal[] = [
  {
    name: 'Marigold Full Cream Milk 1L',
    store: 'fairprice',
    salePrice: 2.55,
    originalPrice: 3.2,
    savingAmount: 0.65,
    savingPct: 20.3,
    url: null,
    promoLabel: 'Save $0.65',
  },
  {
    name: 'Seara Frozen Chicken Breast',
    store: 'fairprice',
    salePrice: 9.45,
    originalPrice: 11.7,
    savingAmount: 2.25,
    savingPct: 19.2,
    url: null,
    promoLabel: 'Save $2.25',
  },
]

const csDeals: RawDeal[] = [
  {
    name: 'Greenfields Fresh Milk 1L',
    store: 'coldstorage',
    salePrice: 3.45,
    originalPrice: 4.2,
    savingAmount: 0.75,
    savingPct: 17.9,
    url: null,
    promoLabel: '20% OFF',
  },
]

const successResult = (deals: RawDeal[]): ScrapeResult => ({ deals, usedFallback: false })
const fallbackResult = (deals: RawDeal[]): ScrapeResult => ({
  deals,
  usedFallback: true,
  error: 'mock fallback',
})

describe('runGroceryAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(scrapeFairPrice).mockResolvedValue(successResult(fpDeals))
    vi.mocked(scrapeColdStorage).mockResolvedValue(fallbackResult(csDeals))
  })

  it('returns a plan and trace', async () => {
    const result = await runGroceryAgent('manual')
    expect(result.plan).toBeDefined()
    expect(result.trace).toBeDefined()
  })

  it('trace has all 4 steps populated', async () => {
    const { trace } = await runGroceryAgent()
    expect(trace.steps.scrape).not.toBeNull()
    expect(trace.steps.matching).not.toBeNull()
    expect(trace.steps.comparison).not.toBeNull()
    expect(trace.steps.store_split).not.toBeNull()
  })

  it('trace run_id matches plan run_id', async () => {
    const { plan, trace } = await runGroceryAgent()
    expect(plan.run_id).toBe(trace.run_id)
  })

  it('usingDemoData is true when any scraper uses fallback', async () => {
    const { usingDemoData } = await runGroceryAgent()
    expect(usingDemoData).toBe(true)
  })

  it('usingDemoData is false when both scrapers succeed', async () => {
    vi.mocked(scrapeFairPrice).mockResolvedValue(successResult(fpDeals))
    vi.mocked(scrapeColdStorage).mockResolvedValue(successResult(csDeals))
    const { usingDemoData } = await runGroceryAgent()
    expect(usingDemoData).toBe(false)
  })

  it('trace scrape step reflects fallback status', async () => {
    const { trace } = await runGroceryAgent()
    expect(trace.steps.scrape?.coldstorage.status).toBe('fallback_used')
    expect(trace.steps.scrape?.fairprice.status).toBe('success')
  })

  it('saves trace to store', async () => {
    await runGroceryAgent()
    expect(traceStore.save).toHaveBeenCalledOnce()
  })

  it('plan has estimated_total and estimated_savings', async () => {
    const { plan } = await runGroceryAgent()
    expect(plan.estimated_total).toBeGreaterThan(0)
    expect(plan.estimated_savings).toBeGreaterThanOrEqual(0)
  })

  it('trace duration_ms is non-negative', async () => {
    const { trace } = await runGroceryAgent()
    expect(trace.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('scrape errors are recorded in trace', async () => {
    vi.mocked(scrapeFairPrice).mockResolvedValue(fallbackResult(fpDeals))
    const { trace } = await runGroceryAgent()
    expect(trace.errors.length).toBeGreaterThan(0)
  })
})
