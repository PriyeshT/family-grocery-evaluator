import Anthropic from '@anthropic-ai/sdk'
import type { FairPricePromotion, MatchedPromotion, PromotionsMatchResult, ShoppingListItem } from '@/types'
import { config } from '@/lib/config'

const anthropic = new Anthropic()

interface LLMMatchResult {
  bestMatchIndex: number
  brandFound: boolean
  alternatives: Array<{ index: number; reason: string }>
}

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

async function semanticMatch(
  term: string,
  preferredBrand: string | undefined,
  candidates: FairPricePromotion[],
): Promise<LLMMatchResult | null> {
  try {
    const candidateList = candidates
      .map((p, i) => `${i}. ${p.name} – $${p.salePrice}${p.savingPct != null ? ` (save ${p.savingPct}%)` : ''}`)
      .join('\n')

    const brandLine = preferredBrand ? `\nPreferred brand: ${preferredBrand}` : ''

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      tools: [
        {
          name: 'submit_match',
          description: 'Submit the best matching promotion for the given shopping list item.',
          input_schema: {
            type: 'object',
            properties: {
              bestMatchIndex: {
                type: 'integer',
                description:
                  'Index of the best matching promotion from the list, or -1 if no suitable match exists',
              },
              brandFound: {
                type: 'boolean',
                description:
                  'True if the preferred brand was matched. Always false when no preferred brand was requested.',
              },
              alternatives: {
                type: 'array',
                description:
                  'Up to 2 alternative promotions to suggest when the preferred brand is not available or when there are meaningfully better options',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'integer', description: 'Index of the alternative promotion' },
                    reason: { type: 'string', description: 'Short reason for this alternative' },
                  },
                  required: ['index', 'reason'],
                },
              },
            },
            required: ['bestMatchIndex', 'brandFound', 'alternatives'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_match' },
      messages: [
        {
          role: 'user',
          content: `Match this shopping list item to the best available promotion. Consider synonyms (e.g. "cooking oil" matches "vegetable oil") and category equivalents.\n\nItem: "${term}"${brandLine}\n\nPromotions:\n${candidateList}`,
        },
      ],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return null

    return toolUse.input as LLMMatchResult
  } catch {
    return null
  }
}

export async function matchPromotionsToList(
  shoppingList: ShoppingListItem[],
  promotions: FairPricePromotion[],
): Promise<Omit<PromotionsMatchResult, 'scrapedAt' | 'usedFallback'>> {
  const matched: MatchedPromotion[] = []
  const unmatched: string[] = []

  for (const { term, preferredBrand } of shoppingList) {
    // Exact substring match is unambiguous — skip LLM for these
    const exactMatches = promotions.filter((p) => exactMatch(term, p.name))
    if (exactMatches.length > 0) {
      const best = exactMatches.reduce((a, b) => ((b.savingPct ?? 0) > (a.savingPct ?? 0) ? b : a))
      matched.push({ shoppingListTerm: term, promotion: best, matchMethod: 'exact', confidence: 1 })
      continue
    }

    if (promotions.length > 0) {
      const llmResult = await semanticMatch(term, preferredBrand, promotions)

      if (llmResult !== null && llmResult.bestMatchIndex >= 0 && llmResult.bestMatchIndex < promotions.length) {
        const alternatives = llmResult.alternatives
          .slice(0, 2)
          .filter((a) => a.index >= 0 && a.index < promotions.length && a.index !== llmResult.bestMatchIndex)
          .map((a) => promotions[a.index])

        matched.push({
          shoppingListTerm: term,
          promotion: promotions[llmResult.bestMatchIndex],
          matchMethod: 'llm',
          confidence: llmResult.brandFound ? 1 : 0.8,
          brandFound: llmResult.brandFound,
          ...(alternatives.length > 0 ? { alternatives } : {}),
        })
        continue
      }

      // LLM failed (null) — fall back to fuzzy; LLM returning -1 means no match
      if (llmResult === null) {
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
          continue
        }
      }
    }

    unmatched.push(term)
  }

  return { matched, unmatched }
}
