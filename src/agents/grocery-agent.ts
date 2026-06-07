import { TraceBuilder } from '@/trace/builder'
import { traceStore } from '@/trace/store'
import { scrapeFairPrice } from '@/tools/scrape-fairprice'
import { scrapeColdStorage } from '@/tools/scrape-coldstorage'
import { matchItemsToDeals, getUnmatched } from '@/tools/match-items'
import { comparePrices } from '@/tools/compare-prices'
import { calculateStoreSplit } from '@/tools/calculate-store-split'
import { SHOPPING_LIST } from '@/lib/shopping-list'
import { config } from '@/lib/config'
import type { ShoppingPlan, PlannedItem, ShoppingListItem } from '@/types'
import type { AgentTrace } from '@/trace/types'

const FAIRPRICE_URL = process.env.FAIRPRICE_URL ?? 'https://www.fairprice.com.sg/promotions'
const COLDSTORAGE_URL = process.env.COLDSTORAGE_URL ?? 'https://www.coldstorage.com.sg/promotions'

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

  // Step 1: Scrape both stores in parallel
  const scrapeStart = Date.now()
  const [fpResult, csResult] = await Promise.all([
    scrapeFairPrice(FAIRPRICE_URL).catch((err) => ({
      deals: [],
      usedFallback: true,
      error: String(err),
    })),
    scrapeColdStorage(COLDSTORAGE_URL).catch((err) => ({
      deals: [],
      usedFallback: true,
      error: String(err),
    })),
  ])
  const scrapeDuration = Date.now() - scrapeStart

  const usingDemoData = fpResult.usedFallback || csResult.usedFallback

  builder.recordScrape({
    fairprice: {
      url: FAIRPRICE_URL,
      status: fpResult.usedFallback ? (fpResult.deals.length > 0 ? 'fallback_used' : 'failed') : 'success',
      items_found: fpResult.deals.length,
      duration_ms: scrapeDuration,
      raw_deals: fpResult.deals,
      ...(fpResult.error ? { error: fpResult.error } : {}),
    },
    coldstorage: {
      url: COLDSTORAGE_URL,
      status: csResult.usedFallback ? (csResult.deals.length > 0 ? 'fallback_used' : 'failed') : 'success',
      items_found: csResult.deals.length,
      duration_ms: scrapeDuration,
      raw_deals: csResult.deals,
      ...(csResult.error ? { error: csResult.error } : {}),
    },
  })

  if (fpResult.error) builder.addError({ step: 'scrape', message: `FairPrice: ${fpResult.error}` })
  if (csResult.error) builder.addError({ step: 'scrape', message: `Cold Storage: ${csResult.error}` })

  // Step 2: Match shopping list items to deals
  const allDeals = [...fpResult.deals, ...csResult.deals]
  const matched = matchItemsToDeals(shoppingList, allDeals)
  const unmatched = getUnmatched(shoppingList, matched)

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

  // Step 3: Compare prices
  const comparison = comparePrices(matched)
  builder.recordComparison(comparison)

  // Step 4: Calculate store split recommendation
  const splitResult = calculateStoreSplit(comparison.items_compared, config)
  builder.recordStoreSplit(splitResult)

  // Build shopping plan
  const plannedItems: PlannedItem[] = matched.map((m) => ({
    shopping_list_term: m.shopping_list_term,
    deal: m.matched_deal,
    store: m.matched_deal.store,
    ...(m.preferredBrand !== undefined ? { preferredBrand: m.preferredBrand, brandMatched: m.brandMatched } : {}),
  }))

  const estimatedTotal = plannedItems.reduce((sum, p) => sum + p.deal.salePrice, 0)
  const estimatedSavings = plannedItems.reduce((sum, p) => sum + (p.deal.savingAmount ?? 0), 0)

  const plan: ShoppingPlan = {
    run_id: builder.getRunId(),
    generated_at: new Date().toISOString(),
    items: plannedItems,
    store_recommendation: {
      recommendation: splitResult.recommendation,
      primary_store: splitResult.primary_store,
      split_store: splitResult.split_store,
      estimated_total_savings: splitResult.estimated_total_savings,
      threshold_applied: splitResult.threshold_applied,
      reasoning: splitResult.reasoning,
    },
    unmatched_items: unmatched,
    estimated_total: parseFloat(estimatedTotal.toFixed(2)),
    estimated_savings: parseFloat(estimatedSavings.toFixed(2)),
  }

  const trace = builder.finalise(plan)
  traceStore.save(trace)

  return { plan, trace, usingDemoData }
}
