import Anthropic from '@anthropic-ai/sdk'
import { TraceBuilder } from '@/trace/builder'
import { traceStore } from '@/trace/store'
import { SHOPPING_LIST } from '@/lib/shopping-list'
import {
  TOOL_DEFINITIONS,
  handleScrapeSection,
  handleMatchItems,
  handleRecordRecommendation,
  type ScrapeToolInput,
  type MatchItemsToolInput,
  type RecordRecommendationToolInput,
} from '@/agents/tools'
import type {
  ShoppingPlan,
  PlannedItem,
  ShoppingListItem,
  FairPricePromotion,
  FairPriceSection,
  RawDeal,
} from '@/types'
import type { AgentTrace, MatchedItem, SectionScrapeResult } from '@/trace/types'

const AGENT_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You are a grocery deal finder for FairPrice Singapore. Find the best promotions for a shopping list.

Available sections:
- flash-deals: Time-limited flash sales (often deepest discounts)
- price-slash: Lowest price in 30 days (reliable everyday savings)
- fresh-picks: Fresh produce deals (best for fruit, vegetables, meat, seafood, dairy)
- weekly: Weekly promotions (broadest category coverage)

How to proceed:
1. Analyse the shopping list and choose which sections are most likely to have relevant deals
2. If the list has fresh produce, meat, seafood, or dairy → start with fresh-picks
3. For general groceries → prioritise price-slash and weekly
4. Call only the sections you need; you are NOT required to call all four
5. After scraping, call match_items to find promotions matching the list
6. If many items remain unmatched, consider scraping another section
7. Always end with record_recommendation once you have your best results`

export interface AgentResult {
  plan: ShoppingPlan
  trace: AgentTrace
  usingDemoData: boolean
}

function toRawDeal(p: FairPricePromotion): RawDeal {
  return {
    name: p.name,
    store: 'fairprice',
    salePrice: p.salePrice,
    originalPrice: p.originalPrice,
    savingAmount: p.savingAmount,
    savingPct: p.savingPct,
    url: p.url,
    promoLabel: p.promoLabel,
  }
}

export async function runGroceryAgent(
  triggerType: 'manual' | 'scheduled' | 'api' = 'manual',
  shoppingList: ShoppingListItem[] = SHOPPING_LIST
): Promise<AgentResult> {
  const builder = new TraceBuilder(triggerType)
  const client = new Anthropic()

  const allPromotions: FairPricePromotion[] = []
  const promotionsByName = new Map<string, FairPricePromotion>()
  const sectionResults: SectionScrapeResult[] = []
  const sectionsSelected: FairPriceSection[] = []
  let usedFallback = false
  let finalRecommendation: RecordRecommendationToolInput | null = null
  let totalScrapeDurationMs = 0

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: 'user',
      content: `Find the best FairPrice promotions for this shopping list:\n${JSON.stringify(shoppingList, null, 2)}`,
    },
  ]

  let continueLoop = true
  while (continueLoop) {
    const response = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    })

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use') {
      continueLoop = false
      break
    }

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      if (block.name === 'scrape_fairprice_section') {
        const input = block.input as ScrapeToolInput
        const section = input.section
        sectionsSelected.push(section)

        const scrapeStart = Date.now()
        const result = await handleScrapeSection(input)
        const scrapeDuration = Date.now() - scrapeStart
        totalScrapeDurationMs += scrapeDuration

        for (const p of result.promotions) {
          allPromotions.push(p)
          promotionsByName.set(p.name, p)
        }

        if (result.usedFallback) usedFallback = true

        const sectionStatus: SectionScrapeResult['status'] =
          result.count === 0 ? 'failed' : result.usedFallback ? 'fallback_used' : 'success'

        sectionResults.push({
          section,
          items_found: result.count,
          duration_ms: scrapeDuration,
          status: sectionStatus,
          ...(result.error ? { error: result.error } : {}),
        })

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      } else if (block.name === 'match_items') {
        const input = block.input as MatchItemsToolInput
        const result = handleMatchItems(input)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      } else if (block.name === 'record_recommendation') {
        const input = block.input as RecordRecommendationToolInput
        finalRecommendation = input
        const result = handleRecordRecommendation(input)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
        continueLoop = false
      }
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults })
    }
  }

  // Build trace scrape step with section-level detail
  const overallStatus: 'success' | 'fallback_used' | 'failed' =
    allPromotions.length === 0 ? 'failed' : usedFallback ? 'fallback_used' : 'success'

  builder.recordScrape({
    fairprice: {
      url: 'https://www.fairprice.com.sg/promotions',
      status: overallStatus,
      items_found: allPromotions.length,
      duration_ms: totalScrapeDurationMs,
      raw_deals: allPromotions.map(toRawDeal),
      sections_selected: sectionsSelected,
      section_results: sectionResults,
    },
  })

  if (usedFallback) {
    builder.addError({ step: 'scrape', message: 'One or more sections used fallback data' })
  }

  // Build matching step from final recommendation
  const matched: MatchedItem[] = (finalRecommendation?.matched ?? []).map((m) => {
    const fullPromotion = promotionsByName.get(m.promotion_name)
    return {
      shopping_list_term: m.shopping_list_term,
      matched_deal: fullPromotion
        ? toRawDeal(fullPromotion)
        : {
            name: m.promotion_name,
            store: 'fairprice' as const,
            salePrice: m.sale_price,
            originalPrice: m.original_price ?? null,
            savingAmount: m.saving_amount ?? null,
            savingPct: m.saving_pct ?? null,
            url: null,
            promoLabel: null,
          },
      match_method: m.match_method ?? 'fuzzy',
      confidence: m.confidence ?? 1,
    }
  })

  const unmatched = finalRecommendation?.unmatched ?? []

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
  }))

  const plan: ShoppingPlan = {
    run_id: builder.getRunId(),
    generated_at: new Date().toISOString(),
    items: plannedItems,
    unmatched_items: unmatched,
    estimated_total: parseFloat(plannedItems.reduce((sum, p) => sum + p.deal.salePrice, 0).toFixed(2)),
    estimated_savings: parseFloat(
      plannedItems.reduce((sum, p) => sum + (p.deal.savingAmount ?? 0), 0).toFixed(2)
    ),
  }

  const trace = builder.finalise(plan)
  traceStore.save(trace)

  return { plan, trace, usingDemoData: usedFallback }
}
