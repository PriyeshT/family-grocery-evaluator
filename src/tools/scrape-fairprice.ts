import * as cheerio from 'cheerio'
import type { RawDeal } from '@/types'
import { MOCK_FAIRPRICE_DEALS } from '@/lib/mock-data'
import { config } from '@/lib/config'

export interface ScrapeResult {
  deals: RawDeal[]
  usedFallback: boolean
  error?: string
}

export async function scrapeFairPrice(url: string): Promise<ScrapeResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return { deals: MOCK_FAIRPRICE_DEALS, usedFallback: true, error: `HTTP ${res.status}` }
    }

    const html = await res.text()
    const deals = parseFairPriceHtml(html)

    if (deals.length === 0) {
      return { deals: MOCK_FAIRPRICE_DEALS, usedFallback: true, error: 'No deals parsed from HTML' }
    }

    return { deals, usedFallback: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { deals: MOCK_FAIRPRICE_DEALS, usedFallback: true, error: message }
  }
}

export function parseFairPriceHtml(html: string): RawDeal[] {
  const $ = cheerio.load(html)
  const deals: RawDeal[] = []

  $('[data-testid="product"]').each((_, el) => {
    const img = $(el).find('[data-testid="recommended-product-image"] img').first()
    const name = img.attr('alt') ?? img.attr('title') ?? ''
    if (!name) return

    const originalPriceEl = $(el).find('[aria-label="Original price"]').first()
    const originalPriceText = originalPriceEl.text().replace('$', '').trim()
    const originalPrice = originalPriceText ? parseFloat(originalPriceText) : null

    // Sale price is the sibling span before the original price span
    const priceContainer = originalPriceEl.closest('[class]').parent()
    const salePriceText = priceContainer
      .find('span')
      .not('[aria-label]')
      .first()
      .text()
      .replace('$', '')
      .trim()
    const salePrice = salePriceText ? parseFloat(salePriceText) : null

    if (!salePrice) return

    const promoEl = $(el).find('[data-testid="promo-label"]')
    const promoLabel = promoEl.length ? promoEl.text().trim() : null

    const linkEl = $(el).closest('a')
    const url = linkEl.length ? linkEl.attr('href') ?? null : null

    const savingAmount =
      originalPrice !== null ? parseFloat((originalPrice - salePrice).toFixed(2)) : null
    const savingPct =
      originalPrice !== null ? parseFloat(((savingAmount! / originalPrice) * 100).toFixed(1)) : null

    deals.push({
      name,
      store: 'fairprice',
      salePrice,
      originalPrice,
      savingAmount,
      savingPct,
      url,
      promoLabel,
    })
  })

  return deals
}
