import type { RawDeal, ShoppingListItem } from '@/types'
import type { MatchedItem } from '@/trace/types'
import { config } from '@/lib/config'

function tokenise(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
}

function exactMatch(term: string, dealName: string): boolean {
  return dealName.toLowerCase().includes(term.toLowerCase())
}

function fuzzyScore(term: string, dealName: string): number {
  const termTokens = tokenise(term)
  const dealTokens = tokenise(dealName)
  if (termTokens.length === 0 || dealTokens.length === 0) return 0
  const matched = termTokens.filter((t) => dealTokens.some((d) => d.includes(t) || t.includes(d)))
  return matched.length / termTokens.length
}

function brandMatch(brand: string, dealName: string): boolean {
  return dealName.toLowerCase().includes(brand.toLowerCase())
}

function bestMatch(candidates: RawDeal[], term: string): { deal: RawDeal; method: 'exact' | 'fuzzy'; score: number } | null {
  const exact = candidates.filter((d) => exactMatch(term, d.name))
  if (exact.length > 0) {
    const best = exact.reduce((a, b) => ((b.savingPct ?? 0) > (a.savingPct ?? 0) ? b : a))
    return { deal: best, method: 'exact', score: 1 }
  }

  const scored = candidates
    .map((d) => ({ deal: d, score: fuzzyScore(term, d.name) }))
    .filter((x) => x.score >= config.fuzzyMatchThreshold)
    .sort((a, b) => b.score - a.score)

  if (scored.length > 0) {
    return { deal: scored[0].deal, method: 'fuzzy', score: scored[0].score }
  }

  return null
}

const STORES = ['fairprice', 'coldstorage'] as const

export function matchItemsToDeals(shoppingList: ShoppingListItem[], deals: RawDeal[]): MatchedItem[] {
  return shoppingList.flatMap((item): MatchedItem[] => {
    const { term, preferredBrand } = item
    const results: MatchedItem[] = []

    for (const store of STORES) {
      const storeDeals = deals.filter((d) => d.store === store)

      // When a preferred brand is set, try brand-constrained candidates first.
      if (preferredBrand) {
        const brandDeals = storeDeals.filter((d) => brandMatch(preferredBrand, d.name))
        const brandResult = bestMatch(brandDeals, term)
        if (brandResult) {
          results.push({
            shopping_list_term: term,
            matched_deal: brandResult.deal,
            match_method: brandResult.method,
            confidence: brandResult.score,
            preferredBrand,
            brandMatched: true,
          })
          continue
        }
      }

      // Fall back to any matching deal (soft fallback when brand not found on promotion).
      const fallbackResult = bestMatch(storeDeals, term)
      if (fallbackResult) {
        results.push({
          shopping_list_term: term,
          matched_deal: fallbackResult.deal,
          match_method: fallbackResult.method,
          confidence: fallbackResult.score,
          ...(preferredBrand ? { preferredBrand, brandMatched: false } : {}),
        })
      }
    }

    return results
  })
}

export function getUnmatched(shoppingList: ShoppingListItem[], matched: MatchedItem[]): string[] {
  const matchedTerms = new Set(matched.map((m) => m.shopping_list_term))
  return shoppingList.filter((i) => !matchedTerms.has(i.term)).map((i) => i.term)
}
