import { describe, it, expect } from 'vitest'
import { parseFairPricePromotionsHtml } from '@/tools/scrape-fairprice-promotions'

function productHtml(opts: {
  alt?: string
  src?: string
  prices?: string[]
  originalPrice?: string
  promoLabel?: string
  href?: string
  validUntil?: string
}) {
  const img = `<img ${opts.alt ? `alt="${opts.alt}"` : ''} ${opts.src ? `src="${opts.src}"` : ''} />`
  const spans = (opts.prices ?? []).map((p) => `<span>${p}</span>`).join('')
  const original = opts.originalPrice
    ? `<span aria-label="Original price">${opts.originalPrice}</span>`
    : ''
  const promo = opts.promoLabel
    ? `<div data-testid="promo-label">${opts.promoLabel}</div>`
    : ''
  const validUntil = opts.validUntil
    ? `<span data-testid="valid-until">${opts.validUntil}</span>`
    : ''
  const inner = `
    <div data-testid="recommended-product-image">${img}</div>
    ${original}${spans}${promo}${validUntil}
  `
  const product = `<div data-testid="product">${inner}</div>`
  return opts.href ? `<a href="${opts.href}">${product}</a>` : product
}

describe('parseFairPricePromotionsHtml', () => {
  it('returns empty array for HTML with no products', () => {
    expect(parseFairPricePromotionsHtml('<html><body></body></html>')).toEqual([])
  })

  it('parses a product with sale price and original price', () => {
    const html = productHtml({
      alt: 'Test Milk 1L',
      src: '/img/milk.jpg',
      prices: ['$2.55'],
      originalPrice: '$3.20',
      promoLabel: 'Save $0.65',
      href: '/product/test-milk',
    })
    const results = parseFairPricePromotionsHtml(html)
    expect(results).toHaveLength(1)
    const p = results[0]
    expect(p.name).toBe('Test Milk 1L')
    expect(p.salePrice).toBe(2.55)
    expect(p.originalPrice).toBe(3.2)
    expect(p.savingAmount).toBe(0.65)
    expect(p.savingPct).toBe(20.3)
    expect(p.promoLabel).toBe('Save $0.65')
    expect(p.imageUrl).toBe('/img/milk.jpg')
    expect(p.url).toBe('https://www.fairprice.com.sg/product/test-milk')
  })

  it('parses a product with no original price', () => {
    const html = productHtml({ alt: 'Red Onion 500g', prices: ['$1.50'] })
    const results = parseFairPricePromotionsHtml(html)
    expect(results).toHaveLength(1)
    expect(results[0].originalPrice).toBeNull()
    expect(results[0].savingAmount).toBeNull()
    expect(results[0].savingPct).toBeNull()
  })

  it('picks the lowest price as the sale price when multiple are shown', () => {
    const html = productHtml({ alt: 'Multi Price Item', prices: ['$5.00', '$3.50'] })
    const results = parseFairPricePromotionsHtml(html)
    expect(results[0].salePrice).toBe(3.5)
  })

  it('skips products with no name', () => {
    const html = productHtml({ prices: ['$2.50'] })
    expect(parseFairPricePromotionsHtml(html)).toHaveLength(0)
  })

  it('skips products with no price', () => {
    const html = productHtml({ alt: 'Product With No Price' })
    expect(parseFairPricePromotionsHtml(html)).toHaveLength(0)
  })

  it('sets category to null when no section is passed', () => {
    const html = productHtml({ alt: 'Rice 5kg', prices: ['$11.90'] })
    expect(parseFairPricePromotionsHtml(html)[0].category).toBeNull()
  })

  it('assigns section passed as second argument to all products', () => {
    const html =
      productHtml({ alt: 'Milk 1L', prices: ['$2.55'] }) +
      productHtml({ alt: 'Bread 400g', prices: ['$2.40'] })
    const results = parseFairPricePromotionsHtml(html, 'flash-deals')
    expect(results).toHaveLength(2)
    expect(results[0].category).toBe('flash-deals')
    expect(results[1].category).toBe('flash-deals')
  })

  it('assigns correct section for all four FairPrice categories', () => {
    const html = productHtml({ alt: 'Item', prices: ['$1.00'] })
    const sections = ['flash-deals', 'price-slash', 'fresh-picks', 'weekly'] as const
    for (const section of sections) {
      expect(parseFairPricePromotionsHtml(html, section)[0].category).toBe(section)
    }
  })

  it('extracts validUntil when present', () => {
    const html = productHtml({ alt: 'Promo Item', prices: ['$3.00'], validUntil: '30 Jun 2026' })
    expect(parseFairPricePromotionsHtml(html)[0].validUntil).toBe('30 Jun 2026')
  })

  it('preserves absolute URLs as-is', () => {
    const html = productHtml({
      alt: 'Some Item',
      prices: ['$2.00'],
      href: 'https://www.fairprice.com.sg/product/some-item',
    })
    expect(parseFairPricePromotionsHtml(html)[0].url).toBe(
      'https://www.fairprice.com.sg/product/some-item'
    )
  })

  it('parses multiple products', () => {
    const html =
      productHtml({ alt: 'Item A', prices: ['$1.00'] }) +
      productHtml({ alt: 'Item B', prices: ['$2.00'] }) +
      productHtml({ alt: 'Item C', prices: ['$3.00'] })
    expect(parseFairPricePromotionsHtml(html)).toHaveLength(3)
  })
})
