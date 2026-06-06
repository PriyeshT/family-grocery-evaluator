import type { RawDeal } from '@/types'
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

const STORES = ['fairprice', 'coldstorage'] as const

export function matchItemsToDeals(shoppingList: string[], deals: RawDeal[]): MatchedItem[] {
  return shoppingList.flatMap((term): MatchedItem[] => {
    const results: MatchedItem[] = []

    for (const store of STORES) {
      const storeDeals = deals.filter((d) => d.store === store)

      // Try exact match first
      const exactMatches = storeDeals.filter((d) => exactMatch(term, d.name))
      if (exactMatches.length > 0) {
        const best = exactMatches.reduce((a, b) =>
          (b.savingPct ?? 0) > (a.savingPct ?? 0) ? b : a
        )
        results.push({ shopping_list_term: term, matched_deal: best, match_method: 'exact', confidence: 1 })
        continue
      }

      // Try fuzzy match
      const scored = storeDeals
        .map((d) => ({ deal: d, score: fuzzyScore(term, d.name) }))
        .filter((x) => x.score >= config.fuzzyMatchThreshold)
        .sort((a, b) => b.score - a.score)

      if (scored.length > 0) {
        const best = scored[0]
        results.push({
          shopping_list_term: term,
          matched_deal: best.deal,
          match_method: 'fuzzy',
          confidence: best.score,
        })
      }
    }

    return results
  })
}

export function getUnmatched(shoppingList: string[], matched: MatchedItem[]): string[] {
  const matchedTerms = new Set(matched.map((m) => m.shopping_list_term))
  return shoppingList.filter((t) => !matchedTerms.has(t))
}
