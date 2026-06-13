import { generateText, tool, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { TraceBuilder } from '@/trace/builder'
import { traceStore } from '@/trace/store'
import { SHOPPING_LIST } from '@/lib/shopping-list'
import {
  handleScrapeSection,
  handleMatchItems,
  handleRecordRecommendation,
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
  const anthropicProvider = createAnthropic()

  const allPromotions: FairPricePromotion[] = []
  const promotionsByName = new Map<string, FairPricePromotion>()
  const sectionResults: SectionScrapeResult[] = []
  const sectionsSelected: FairPriceSection[] = []
  let usedFallback = false
  let finalRecommendation: RecordRecommendationToolInput | null = null
  let totalScrapeDurationMs = 0

  const tools = {
    scrape_fairprice_section: tool({
      description:
        'Scrapes live promotions from one FairPrice section. ' +
        'Call once per section you want data from — results are cached in memory for the session. ' +
        'Available sections: flash-deals (time-limited flash sales), price-slash (lowest price in 30 days), ' +
        'fresh-picks (fresh produce deals), weekly (weekly promotions). ' +
        'Returns the promotion list for that section including prices, savings, and promo labels.',
      inputSchema: z.object({
        section: z
          .enum(['flash-deals', 'price-slash', 'fresh-picks', 'weekly'])
          .describe('The FairPrice promotion section to scrape'),
      }),
      execute: async ({ section }) => {
        const scrapeStart = Date.now()
        const result = await handleScrapeSection({ section })
        const scrapeDuration = Date.now() - scrapeStart
        totalScrapeDurationMs += scrapeDuration
        sectionsSelected.push(section)

        for (const p of result.promotions) {
          allPromotions.push(p)
          promotionsByName.set(p.name, p)
        }
        if (result.usedFallback) usedFallback = true

        const status: SectionScrapeResult['status'] =
          result.count === 0 ? 'failed' : result.usedFallback ? 'fallback_used' : 'success'
        sectionResults.push({
          section,
          items_found: result.count,
          duration_ms: scrapeDuration,
          status,
          ...(result.error ? { error: result.error } : {}),
        })

        builder.recordToolCall({ tool: 'scrape_fairprice_section', input: { section }, output: result, durationMs: scrapeDuration })
        return result
      },
    }),

    match_items: tool({
      description:
        'Matches shopping list items against a set of scraped promotions using exact and fuzzy matching. ' +
        'Exact matches (item name contained in promotion name) are preferred; fuzzy matching falls back to ' +
        'token-overlap scoring above a confidence threshold. ' +
        'Returns matched promotions with confidence scores, and a list of items with no match found. ' +
        'Call after scraping to find which promotions are relevant to the shopping list.',
      inputSchema: z.object({
        shopping_list: z
          .array(
            z.object({
              term: z.string().describe('The item name or search term (e.g. "chicken breast", "whole milk")'),
              preferredBrand: z.string().optional().describe('Optional brand preference for this item'),
            })
          )
          .describe('The shopping list items to match against promotions'),
        promotions: z
          .array(
            z.object({
              name: z.string(),
              salePrice: z.number(),
              originalPrice: z.number().nullable().optional(),
              savingAmount: z.number().nullable().optional(),
              savingPct: z.number().nullable().optional(),
              promoLabel: z.string().nullable().optional(),
              category: z.string().nullable().optional(),
              imageUrl: z.string().nullable().optional(),
              url: z.string().nullable().optional(),
              validUntil: z.string().nullable().optional(),
            })
          )
          .describe('The promotions to match against, as returned by scrape_fairprice_section'),
      }),
      execute: async (input) => {
        const matchStart = Date.now()
        const result = await handleMatchItems(input as { shopping_list: ShoppingListItem[]; promotions: FairPricePromotion[] })
        builder.recordToolCall({ tool: 'match_items', input: input as Record<string, unknown>, output: result, durationMs: Date.now() - matchStart })
        return result
      },
    }),

    record_recommendation: tool({
      description:
        'Finalises the agent run. Call this exactly once — after all scraping and matching is complete — ' +
        'to record the final recommendation. Include every matched item, any alternatives you considered ' +
        '(e.g. a different brand when the preferred one is not on sale), unmatched items, and a plain-English ' +
        'savings summary. This is always the last tool call in the loop.',
      inputSchema: z.object({
        matched: z.array(
          z.object({
            shopping_list_term: z.string(),
            promotion_name: z.string(),
            sale_price: z.number(),
            original_price: z.number().optional(),
            saving_amount: z.number().optional(),
            saving_pct: z.number().optional(),
            confidence: z.number().optional(),
            match_method: z.enum(['exact', 'fuzzy']).optional(),
          })
        ),
        alternatives: z.array(
          z.object({
            shopping_list_term: z.string(),
            reason: z.string(),
            promotion_name: z.string(),
            sale_price: z.number(),
          })
        ),
        unmatched: z.array(z.string()),
        savings_summary: z.string().optional(),
      }),
      execute: async (input) => {
        const recStart = Date.now()
        finalRecommendation = input as RecordRecommendationToolInput
        const result = await handleRecordRecommendation(input as RecordRecommendationToolInput)
        builder.recordToolCall({ tool: 'record_recommendation', input: input as Record<string, unknown>, output: result, durationMs: Date.now() - recStart })
        return result
      },
    }),
  }

  const agentResult = await generateText({
    model: anthropicProvider(AGENT_MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Find the best FairPrice promotions for this shopping list:\n${JSON.stringify(shoppingList, null, 2)}`,
    tools,
    stopWhen: stepCountIs(10),
  })

  for (const step of agentResult.steps) {
    builder.recordLlmStep({
      model: AGENT_MODEL,
      inputTokens: step.usage.inputTokens ?? 0,
      outputTokens: step.usage.outputTokens ?? 0,
      toolCalled: step.toolCalls[0]?.toolName ?? null,
      reasoning: step.text || null,
    })
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
  const rec = finalRecommendation as RecordRecommendationToolInput | null
  const matched: MatchedItem[] = (rec?.matched ?? []).map((m) => {
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

  const unmatched = rec?.unmatched ?? []

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
