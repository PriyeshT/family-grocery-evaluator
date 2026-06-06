import * as cheerio from 'cheerio'
import type { AnyNode, Element as DomElement } from 'domhandler'
import type { FairPricePromotion, FairPriceSection, PromotionsResult } from '@/types'
import { MOCK_FAIRPRICE_PROMOTIONS } from '@/lib/mock-data'
import { config } from '@/lib/config'

const SECTION_PATTERNS: [RegExp, FairPriceSection][] = [
  [/flash\s+deals?/i, 'flash-deals'],
  [/price\s+slash/i, 'price-slash'],
  [/fresh\s+picks?/i, 'fresh-picks'],
  [/weekly\s+prom/i, 'weekly'],
]

function detectSection(text: string): FairPriceSection | null {
  for (const [pattern, section] of SECTION_PATTERNS) {
    if (pattern.test(text)) return section
  }
  return null
}

let cache: { result: PromotionsResult; expiresAt: number } | null = null

export async function scrapeFairPricePromotions(): Promise<PromotionsResult> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.result
  }

  const scrapedAt = new Date().toISOString()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs)

    const res = await fetch(config.fairpricePromotionsUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return fallback(scrapedAt, `HTTP ${res.status}`)
    }

    const html = await res.text()
    const promotions = parseFairPricePromotionsHtml(html)

    if (promotions.length === 0) {
      return fallback(scrapedAt, 'No promotions parsed from HTML — page may be JS-rendered')
    }

    const result: PromotionsResult = { promotions, scrapedAt, usedFallback: false }
    cache = { result, expiresAt: Date.now() + config.promotionsCacheTtlMs }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return fallback(scrapedAt, message)
  }
}

function fallback(scrapedAt: string, error: string): PromotionsResult {
  return { promotions: MOCK_FAIRPRICE_PROMOTIONS, scrapedAt, usedFallback: true, error }
}

export function parseFairPricePromotionsHtml(html: string): FairPricePromotion[] {
  const $ = cheerio.load(html)
  const promotions: FairPricePromotion[] = []
  const seen = new WeakSet<object>()
  let currentSection: FairPriceSection | null = null

  $('*').each((_, el) => {
    if (el.type !== 'tag') return
    const tag = (el as DomElement).tagName.toLowerCase()

    if (['h1', 'h2', 'h3', 'h4'].includes(tag)) {
      const detected = detectSection($(el).text().trim())
      if (detected) currentSection = detected
      return
    }

    if ($(el).attr('data-testid') === 'product' && !seen.has(el)) {
      seen.add(el)
      const promotion = parseProduct($, el, currentSection)
      if (promotion) promotions.push(promotion)
    }
  })

  return promotions
}

function parseProduct(
  $: cheerio.CheerioAPI,
  el: AnyNode,
  section: FairPriceSection | null,
): FairPricePromotion | null {
  const img = $(el).find('[data-testid="recommended-product-image"] img').first()
  const name = img.attr('alt') ?? img.attr('title') ?? ''
  const imageUrl = img.attr('src') ?? null
  if (!name) return null

  const priceValues = $(el)
    .find('span')
    .map((_, s) => $(s).text().trim())
    .get()
    .filter((t) => /^\$[\d]+\.\d{2}$/.test(t))
    .map((t) => parseFloat(t.replace('$', '')))

  if (priceValues.length === 0) return null

  const originalPriceEl = $(el).find('[aria-label="Original price"]').first()
  const originalPriceText = originalPriceEl.text().replace('$', '').trim()
  const originalPrice = originalPriceText ? parseFloat(originalPriceText) : null
  const salePrice = Math.min(...priceValues)

  const promoEl = $(el).find('[data-testid="promo-label"]')
  const promoLabel = promoEl.length ? promoEl.text().trim() : null

  const linkEl = $(el).closest('a')
  const relativeUrl = linkEl.length ? (linkEl.attr('href') ?? null) : null
  const url = relativeUrl
    ? relativeUrl.startsWith('http')
      ? relativeUrl
      : `https://www.fairprice.com.sg${relativeUrl}`
    : null

  const savingAmount =
    originalPrice !== null ? parseFloat((originalPrice - salePrice).toFixed(2)) : null
  const savingPct =
    originalPrice !== null
      ? parseFloat(((savingAmount! / originalPrice) * 100).toFixed(1))
      : null

  const validUntilEl = $(el).find('[data-testid="valid-until"]').first()
  const validUntil = validUntilEl.length ? validUntilEl.text().trim() : null

  return {
    name,
    salePrice,
    originalPrice,
    savingAmount,
    savingPct,
    promoLabel,
    category: section,
    imageUrl,
    url,
    validUntil,
  }
}
