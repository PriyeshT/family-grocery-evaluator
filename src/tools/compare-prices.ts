import type { RawDeal } from '@/types'
import type { MatchedItem, ComparedItem, ComparisonStep } from '@/trace/types'

export function comparePrices(matched: MatchedItem[]): ComparisonStep {
  // Group by shopping list term — collect best deal per store per item
  const byTerm = new Map<string, { fairprice?: RawDeal; coldstorage?: RawDeal }>()

  for (const m of matched) {
    const existing = byTerm.get(m.shopping_list_term) ?? {}
    const deal = m.matched_deal
    const current = existing[deal.store]
    // Keep the cheaper deal if there are duplicates
    if (!current || deal.salePrice < current.salePrice) {
      existing[deal.store] = deal
    }
    byTerm.set(m.shopping_list_term, existing)
  }

  const items_compared: ComparedItem[] = []
  const items_single_store: string[] = []

  for (const [term, stores] of byTerm.entries()) {
    const fp = stores.fairprice ?? null
    const cs = stores.coldstorage ?? null

    if (fp && cs) {
      const fpPrice = fp.salePrice
      const csPrice = cs.salePrice
      const winner: 'fairprice' | 'coldstorage' = fpPrice <= csPrice ? 'fairprice' : 'coldstorage'
      const cheaper = winner === 'fairprice' ? fp : cs
      const pricier = winner === 'fairprice' ? cs : fp
      const saving_amount = parseFloat((pricier.salePrice - cheaper.salePrice).toFixed(2))
      const saving_pct = parseFloat(((saving_amount / pricier.salePrice) * 100).toFixed(1))

      items_compared.push({
        item_name: term,
        fairprice_deal: fp,
        coldstorage_deal: cs,
        winner,
        saving_amount,
        saving_pct,
      })
    } else {
      const available = fp ?? cs!
      items_single_store.push(term)
      items_compared.push({
        item_name: term,
        fairprice_deal: fp,
        coldstorage_deal: cs,
        winner: available.store,
        saving_amount: 0,
        saving_pct: 0,
      })
    }
  }

  return { items_compared, items_single_store }
}
