import type { RawDeal } from '@/types'
import { MOCK_COLDSTORAGE_DEALS } from '@/lib/mock-data'

export interface ScrapeResult {
  deals: RawDeal[]
  usedFallback: boolean
  error?: string
}

// Cold Storage's promotions page requires JS rendering and is geo-restricted in CI/server
// environments. All server-side fetches fall back to mock data.
// Phase 2: replace with Playwright-based scraping.
export async function scrapeColdStorage(_url: string): Promise<ScrapeResult> {
  return {
    deals: MOCK_COLDSTORAGE_DEALS,
    usedFallback: true,
    error: 'Cold Storage requires JS rendering — using mock data (Phase 2: Playwright)',
  }
}
