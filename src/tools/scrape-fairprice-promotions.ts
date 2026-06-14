import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import type { FairPricePromotion, FairPriceSection, PromotionsResult } from '@/types'
import { MOCK_FAIRPRICE_PROMOTIONS } from '@/lib/mock-data'
import { config } from '@/lib/config'

const SECTION_URLS: Record<FairPriceSection, string> = {
  'flash-deals': 'https://www.fairprice.com.sg/promotions?tag=campaign-flash-sale',
  'price-slash': 'https://www.fairprice.com.sg/promotions?tag=curated-lowest-price-in-30-days',
  'fresh-picks': 'https://www.fairprice.com.sg/promotions?tag=fresh-picks-1',
  'weekly': 'https://www.fairprice.com.sg/promotions?tag=promotions-boost',
}

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
}

let cache: { result: PromotionsResult; expiresAt: number } | null = null

const sectionCache = new Map<
  FairPriceSection,
  { result: { promotions: FairPricePromotion[]; usedFallback: boolean; scrapedAt: string; error?: string }; expiresAt: number }
>()

export async function scrapeFairPriceSectionOnly(section: FairPriceSection): Promise<{
  promotions: FairPricePromotion[]
  usedFallback: boolean
  scrapedAt: string
  error?: string
}> {
  const cached = sectionCache.get(section)
  if (cached && Date.now() < cached.expiresAt) return cached.result

  const scrapedAt = new Date().toISOString()
  const url = SECTION_URLS[section]

  const store = (result: { promotions: FairPricePromotion[]; usedFallback: boolean; scrapedAt: string; error?: string }) => {
    sectionCache.set(section, { result, expiresAt: Date.now() + config.promotionsCacheTtlMs })
    return result
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs)
    const res = await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS })
    clearTimeout(timeout)

    if (!res.ok) {
      return store({
        promotions: MOCK_FAIRPRICE_PROMOTIONS.filter((p) => p.category === section),
        usedFallback: true,
        scrapedAt,
        error: `HTTP ${res.status}`,
      })
    }

    const html = await res.text()
    const promotions = parseFairPricePromotionsHtml(html, section)

    if (promotions.length === 0) {
      return store({
        promotions: MOCK_FAIRPRICE_PROMOTIONS.filter((p) => p.category === section),
        usedFallback: true,
        scrapedAt,
        error: 'No products parsed — page may be JS-rendered',
      })
    }

    return store({ promotions, usedFallback: false, scrapedAt })
  } catch (err) {
    return store({
      promotions: MOCK_FAIRPRICE_PROMOTIONS.filter((p) => p.category === section),
      usedFallback: true,
      scrapedAt,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function scrapeFairPricePromotions(): Promise<PromotionsResult> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.result
  }

  const scrapedAt = new Date().toISOString()
  const sectionEntries = Object.entries(SECTION_URLS) as [FairPriceSection, string][]

  const sectionResults = await Promise.all(
    sectionEntries.map(async ([section, url]) => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs)
        const res = await fetch(url, { signal: controller.signal, headers: FETCH_HEADERS })
        clearTimeout(timeout)
        if (!res.ok) return { section, promotions: null, error: `HTTP ${res.status}` }
        const html = await res.text()
        const promotions = parseFairPricePromotionsHtml(html, section)
        return {
          section,
          promotions: promotions.length > 0 ? promotions : null,
          error: promotions.length === 0 ? 'No products parsed — page may be JS-rendered' : undefined,
        }
      } catch (err) {
        return { section, promotions: null, error: err instanceof Error ? err.message : String(err) }
      }
    }),
  )

  const allPromotions: FairPricePromotion[] = []
  const errors: string[] = []
  let anyFailed = false

  for (const { section, promotions, error } of sectionResults) {
    if (promotions) {
      allPromotions.push(...promotions)
    } else {
      anyFailed = true
      if (error) errors.push(`${section}: ${error}`)
      allPromotions.push(...MOCK_FAIRPRICE_PROMOTIONS.filter((p) => p.category === section))
    }
  }

  const result: PromotionsResult = {
    promotions: allPromotions,
    scrapedAt,
    usedFallback: anyFailed,
    ...(errors.length > 0 ? { error: errors.join('; ') } : {}),
  }

  cache = { result, expiresAt: Date.now() + config.promotionsCacheTtlMs }
  return result
}

export function parseFairPricePromotionsHtml(
  html: string,
  section: FairPriceSection | null = null,
): FairPricePromotion[] {
  const $ = cheerio.load(html)
  const promotions: FairPricePromotion[] = []

  $('[data-testid="product"]').each((_, el) => {
    const promotion = parseProduct($, el, section)
    if (promotion) promotions.push(promotion)
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
