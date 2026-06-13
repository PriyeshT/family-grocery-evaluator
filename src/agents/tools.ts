import type Anthropic from '@anthropic-ai/sdk'
import { scrapeFairPriceSectionOnly } from '@/tools/scrape-fairprice-promotions'
import { matchPromotionsToList } from '@/tools/match-promotions'
import type {
  FairPriceSection,
  FairPricePromotion,
  ShoppingListItem,
  MatchedPromotion,
  SubstitutedBrand,
} from '@/types'

// ─── Tool input types ──────────────────────────────────────────────────────

export interface ScrapeToolInput {
  section: FairPriceSection
}

export interface MatchItemsToolInput {
  shopping_list: ShoppingListItem[]
  promotions: FairPricePromotion[]
}

export interface RecommendedItem {
  shopping_list_term: string
  promotion_name: string
  sale_price: number
  original_price?: number
  saving_amount?: number
  saving_pct?: number
  confidence?: number
  match_method?: 'exact' | 'fuzzy'
}

export interface AlternativeItem {
  shopping_list_term: string
  reason: string
  promotion_name: string
  sale_price: number
}

export interface RecordRecommendationToolInput {
  matched: RecommendedItem[]
  alternatives: AlternativeItem[]
  unmatched: string[]
  savings_summary?: string
  summary?: string
  substituted_brands?: SubstitutedBrand[]
}

// ─── Tool schemas ──────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: Anthropic.Messages.Tool[] = [
  {
    name: 'scrape_fairprice_section',
    description:
      'Scrapes live promotions from one FairPrice section. ' +
      'Call once per section you want data from — results are cached in memory for the session. ' +
      'Available sections: flash-deals (time-limited flash sales), price-slash (lowest price in 30 days), ' +
      'fresh-picks (fresh produce deals), weekly (weekly promotions). ' +
      'Returns the promotion list for that section including prices, savings, and promo labels.',
    input_schema: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          enum: ['flash-deals', 'price-slash', 'fresh-picks', 'weekly'],
          description: 'The FairPrice promotion section to scrape',
        },
      },
      required: ['section'],
    },
  },
  {
    name: 'match_items',
    description:
      'Matches shopping list items against a set of scraped promotions using exact and fuzzy matching. ' +
      'Exact matches (item name contained in promotion name) are preferred; fuzzy matching falls back to ' +
      'token-overlap scoring above a confidence threshold. ' +
      'Returns matched promotions with confidence scores, and a list of items with no match found. ' +
      'Call after scraping to find which promotions are relevant to the shopping list.',
    input_schema: {
      type: 'object',
      properties: {
        shopping_list: {
          type: 'array',
          description: 'The shopping list items to match against promotions',
          items: {
            type: 'object',
            properties: {
              term: {
                type: 'string',
                description: 'The item name or search term (e.g. "chicken breast", "whole milk")',
              },
              preferredBrand: {
                type: 'string',
                description: 'Optional brand preference for this item (e.g. "Meiji", "Farmhouse")',
              },
            },
            required: ['term'],
          },
        },
        promotions: {
          type: 'array',
          description: 'The promotions to match against, as returned by scrape_fairprice_section',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              salePrice: { type: 'number' },
              originalPrice: { type: 'number' },
              savingAmount: { type: 'number' },
              savingPct: { type: 'number' },
              promoLabel: { type: 'string' },
              category: { type: 'string' },
              imageUrl: { type: 'string' },
              url: { type: 'string' },
              validUntil: { type: 'string' },
            },
            required: ['name', 'salePrice'],
          },
        },
      },
      required: ['shopping_list', 'promotions'],
    },
  },
  {
    name: 'record_recommendation',
    description:
      'Finalises the agent run. Call this exactly once — after all scraping and matching is complete — ' +
      'to record the final recommendation. Include every matched item, any alternatives you considered ' +
      '(e.g. a different brand when the preferred one is not on sale), unmatched items, and a plain-English ' +
      'savings summary. This is always the last tool call in the loop.',
    input_schema: {
      type: 'object',
      properties: {
        matched: {
          type: 'array',
          description: 'Shopping list items that were successfully matched to a promotion',
          items: {
            type: 'object',
            properties: {
              shopping_list_term: { type: 'string' },
              promotion_name: { type: 'string' },
              sale_price: { type: 'number' },
              original_price: { type: 'number' },
              saving_amount: { type: 'number' },
              saving_pct: { type: 'number' },
              confidence: {
                type: 'number',
                description: 'Match confidence score between 0 and 1',
              },
              match_method: {
                type: 'string',
                enum: ['exact', 'fuzzy'],
              },
            },
            required: ['shopping_list_term', 'promotion_name', 'sale_price'],
          },
        },
        alternatives: {
          type: 'array',
          description:
            'Alternative suggestions where the top match is not ideal — e.g. preferred brand not on sale, ' +
            'or a better-value option exists in a different category',
          items: {
            type: 'object',
            properties: {
              shopping_list_term: { type: 'string' },
              reason: {
                type: 'string',
                description: 'Why this is flagged as an alternative rather than the primary match',
              },
              promotion_name: { type: 'string' },
              sale_price: { type: 'number' },
            },
            required: ['shopping_list_term', 'reason', 'promotion_name', 'sale_price'],
          },
        },
        unmatched: {
          type: 'array',
          description: 'Shopping list terms with no matching promotion found',
          items: { type: 'string' },
        },
        savings_summary: {
          type: 'string',
          description: 'Human-readable summary of the total estimated savings across all matched items',
        },
        summary: {
          type: 'string',
          description:
            'Plain-English recommendation in 2-4 sentences. Cover: how many items matched, estimated savings, ' +
            'any notable brand substitutions, and whether this is a good week to stock up.',
        },
        substituted_brands: {
          type: 'array',
          description: 'Items where the preferred brand was not on promotion and a substitute was used',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string', description: 'The shopping list term' },
              found: { type: 'string', description: 'The brand found on promotion' },
              preferred: { type: 'string', description: 'The preferred brand that was not available' },
            },
            required: ['term', 'found', 'preferred'],
          },
        },
      },
      required: ['matched', 'alternatives', 'unmatched', 'summary'],
    },
  },
]

// ─── Tool handlers ─────────────────────────────────────────────────────────

export async function handleScrapeSection(input: ScrapeToolInput): Promise<{
  promotions: FairPricePromotion[]
  count: number
  usedFallback: boolean
  scrapedAt: string
  error?: string
}> {
  const result = await scrapeFairPriceSectionOnly(input.section)
  return {
    promotions: result.promotions,
    count: result.promotions.length,
    usedFallback: result.usedFallback,
    scrapedAt: result.scrapedAt,
    ...(result.error ? { error: result.error } : {}),
  }
}

export async function handleMatchItems(input: MatchItemsToolInput): Promise<{
  matched: MatchedPromotion[]
  unmatched: string[]
  matchedCount: number
  unmatchedCount: number
}> {
  const result = await matchPromotionsToList(input.shopping_list, input.promotions)
  return {
    ...result,
    matchedCount: result.matched.length,
    unmatchedCount: result.unmatched.length,
  }
}

export function handleRecordRecommendation(input: RecordRecommendationToolInput): {
  recorded: true
  matchedCount: number
  alternativesCount: number
  unmatchedCount: number
} {
  return {
    recorded: true,
    matchedCount: input.matched.length,
    alternativesCount: input.alternatives.length,
    unmatchedCount: input.unmatched.length,
  }
}
