import { TraceBuilder } from '@/trace/builder'
import { traceStore } from '@/trace/store'
import { scrapeFairPrice } from '@/tools/scrape-fairprice'
import { SHOPPING_LIST } from '@/lib/shopping-list'
import { config } from '@/lib/config'
import type { ShoppingPlan, PlannedItem, ShoppingListItem, RawDeal } from '@/types'
import type { AgentTrace, MatchedItem } from '@/trace/types'

const FAIRPRICE_URL = process.env.FAIRPRICE_URL ?? 'https://www.fairprice.com.sg/promotions'

export interface AgentResult {
  plan: ShoppingPlan
  trace: AgentTrace
  usingDemoData: boolean
}

export async function runGroceryAgent(
  triggerType: 'manual' | 'scheduled' | 'api' = 'manual',
  shoppingList: ShoppingListItem[] = SHOPPING_LIST
): Promise<AgentResult> {
  const builder = new TraceBuilder(triggerType)

  // Step 1: Scrape FairPrice
  const scrapeStart = Date.now()
  const fpResult = await scrapeFairPrice(FAIRPRICE_URL).catch((err) => ({
    deals: [],
    usedFallback: true,
    error: String(err),
  }))
  const scrapeDuration = Date.now() - scrapeStart

  builder.recordScrape({
    fairprice: {
      url: FAIRPRICE_URL,
      status: fpResult.usedFallback ? (fpResult.deals.length > 0 ? 'fallback_used' : 'failed') : 'success',
      items_found: fpResult.deals.length,
      duration_ms: scrapeDuration,
      raw_deals: fpResult.deals,
      ...(fpResult.error ? { error: fpResult.error } : {}),
    },
  })

  if (fpResult.error) builder.addError({ step: 'scrape', message: `FairPrice: ${fpResult.error}` })

  // Step 2: Match shopping list items to FairPrice deals
  const { matched, unmatched } = matchFairPriceDeals(shoppingList, fpResult.deals)

  const lowConfidence = matched.filter((m) => m.confidence < 0.7 && m.match_method === 'fuzzy')
  if (lowConfidence.length > 0) {
    builder.addWarning(
      `${lowConfidence.length} item(s) had low match confidence: ${lowConfidence.map((m) => m.shopping_list_term).join(', ')}`
    )
  }

  builder.recordMatching({
    shopping_list: shoppingList,
    matched,
    unmatched,
    match_methods_used: [...new Set(matched.map((m) => m.match_method))] as Array<'exact' | 'fuzzy' | 'none'>,
  })

  const plannedItems: PlannedItem[] = matched.map((m) => ({
    shopping_list_term: m.shopping_list_term,
    deal: m.matched_deal,
    store: 'fairprice' as const,
    ...(m.preferredBrand !== undefined ? { preferredBrand: m.preferredBrand, brandMatched: m.brandMatched } : {}),
  }))

  const plan: ShoppingPlan = {
    run_id: builder.getRunId(),
    generated_at: new Date().toISOString(),
    items: plannedItems,
    unmatched_items: unmatched,
    estimated_total: parseFloat(plannedItems.reduce((sum, p) => sum + p.deal.salePrice, 0).toFixed(2)),
    estimated_savings: parseFloat(plannedItems.reduce((sum, p) => sum + (p.deal.savingAmount ?? 0), 0).toFixed(2)),
  }

  const trace = builder.finalise(plan)
  traceStore.save(trace)

  return { plan, trace, usingDemoData: fpResult.usedFallback }
}

function tokenise(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
}

function fuzzyScore(term: string, dealName: string): number {
  const termTokens = tokenise(term)
  const dealTokens = tokenise(dealName)
  if (!termTokens.length || !dealTokens.length) return 0
  const hits = termTokens.filter((t) => dealTokens.some((d) => d.includes(t) || t.includes(d)))
  return hits.length / termTokens.length
}

function pickBest(
  candidates: RawDeal[],
  term: string
): { deal: RawDeal; method: 'exact' | 'fuzzy'; score: number } | null {
  const exact = candidates.filter((d) => d.name.toLowerCase().includes(term.toLowerCase()))
  if (exact.length > 0) {
    const best = exact.reduce((a, b) => ((b.savingPct ?? 0) > (a.savingPct ?? 0) ? b : a))
    return { deal: best, method: 'exact', score: 1 }
  }
  const scored = candidates
    .map((d) => ({ deal: d, score: fuzzyScore(term, d.name) }))
    .filter((x) => x.score >= config.fuzzyMatchThreshold)
    .sort((a, b) => b.score - a.score)
  return scored.length > 0 ? { deal: scored[0].deal, method: 'fuzzy', score: scored[0].score } : null
}

function matchFairPriceDeals(
  shoppingList: ShoppingListItem[],
  deals: RawDeal[]
): { matched: MatchedItem[]; unmatched: string[] } {
  const matched: MatchedItem[] = []

  for (const { term, preferredBrand } of shoppingList) {
    if (preferredBrand) {
      const branded = deals.filter((d) => d.name.toLowerCase().includes(preferredBrand.toLowerCase()))
      const brandResult = pickBest(branded, term)
      if (brandResult) {
        matched.push({
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
    const result = pickBest(deals, term)
    if (result) {
      matched.push({
        shopping_list_term: term,
        matched_deal: result.deal,
        match_method: result.method,
        confidence: result.score,
        ...(preferredBrand ? { preferredBrand, brandMatched: false } : {}),
      })
    }
  }

  const matchedTerms = new Set(matched.map((m) => m.shopping_list_term))
  const unmatched = shoppingList.filter((i) => !matchedTerms.has(i.term)).map((i) => i.term)
  return { matched, unmatched }
}
