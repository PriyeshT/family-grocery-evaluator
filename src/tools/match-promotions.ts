import type { FairPricePromotion, MatchedPromotion, PromotionsMatchResult, ShoppingListItem } from '@/types'
import { config } from '@/lib/config'

function tokenise(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
}

function exactMatch(term: string, name: string): boolean {
  return name.toLowerCase().includes(term.toLowerCase())
}

function fuzzyScore(term: string, name: string): number {
  const termTokens = tokenise(term)
  const nameTokens = tokenise(name)
  if (termTokens.length === 0 || nameTokens.length === 0) return 0
  const matched = termTokens.filter((t) => nameTokens.some((n) => n.includes(t) || t.includes(n)))
  return matched.length / termTokens.length
}

export function matchPromotionsToList(
  shoppingList: ShoppingListItem[],
  promotions: FairPricePromotion[],
): Omit<PromotionsMatchResult, 'scrapedAt' | 'usedFallback'> {
  const matched: MatchedPromotion[] = []
  const unmatched: string[] = []

  for (const { term } of shoppingList) {
    const exactMatches = promotions.filter((p) => exactMatch(term, p.name))
    if (exactMatches.length > 0) {
      const best = exactMatches.reduce((a, b) => ((b.savingPct ?? 0) > (a.savingPct ?? 0) ? b : a))
      matched.push({ shoppingListTerm: term, promotion: best, matchMethod: 'exact', confidence: 1 })
      continue
    }

    const scored = promotions
      .map((p) => ({ promotion: p, score: fuzzyScore(term, p.name) }))
      .filter((x) => x.score >= config.fuzzyMatchThreshold)
      .sort((a, b) => b.score - a.score)

    if (scored.length > 0) {
      matched.push({
        shoppingListTerm: term,
        promotion: scored[0].promotion,
        matchMethod: 'fuzzy',
        confidence: scored[0].score,
      })
    } else {
      unmatched.push(term)
    }
  }

  return { matched, unmatched }
}
