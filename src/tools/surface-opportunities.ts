import Anthropic from '@anthropic-ai/sdk'
import type { FairPricePromotion, OpportunityItem, ShoppingListItem } from '@/types'

const anthropic = new Anthropic()

interface LLMOpportunityResult {
  opportunities: Array<{ index: number; rationale: string }>
}

export async function surfaceOpportunities(
  shoppingList: ShoppingListItem[],
  promotions: FairPricePromotion[],
): Promise<OpportunityItem[]> {
  const listTerms = new Set(shoppingList.map((i) => i.term.toLowerCase()))

  // Exclude items already on the list (by exact or partial name match)
  const candidates = promotions.filter((p) => {
    const nameLower = p.name.toLowerCase()
    return ![...listTerms].some((term) => nameLower.includes(term) || term.includes(nameLower.split(' ')[0]))
  })

  if (candidates.length === 0) return []

  // Sort by saving% descending to focus LLM on high-value items
  const sorted = [...candidates].sort((a, b) => (b.savingPct ?? 0) - (a.savingPct ?? 0))
  const top = sorted.slice(0, 40)

  const promotionList = top
    .map(
      (p, i) =>
        `${i}. ${p.name} – $${p.salePrice.toFixed(2)}${p.savingPct != null ? ` (save ${p.savingPct}%)` : ''}${p.category ? ` [${p.category}]` : ''}`,
    )
    .join('\n')

  const shoppingListSummary = shoppingList.map((i) => i.term).join(', ')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      tools: [
        {
          name: 'submit_opportunities',
          description: 'Submit 3–5 promoted items the family is likely to need this week.',
          input_schema: {
            type: 'object',
            properties: {
              opportunities: {
                type: 'array',
                minItems: 1,
                maxItems: 5,
                items: {
                  type: 'object',
                  properties: {
                    index: {
                      type: 'integer',
                      description: 'Index of the promotion from the provided list',
                    },
                    rationale: {
                      type: 'string',
                      description:
                        'One sentence explaining why this item is worth adding (mention the saving and relevance)',
                    },
                  },
                  required: ['index', 'rationale'],
                },
              },
            },
            required: ['opportunities'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_opportunities' },
      messages: [
        {
          role: 'user',
          content: `You are a smart grocery advisor for a family in Singapore. The family's current shopping list includes: ${shoppingListSummary}.

From the promotions below (items NOT already on their list), pick 3–5 that are worth adding this week. Prioritise:
1. High saving percentage (good value)
2. Common household staples (protein, dairy, produce, pantry essentials)
3. Variety across categories

For each pick, write a short one-sentence rationale that mentions the saving and why it's relevant.

Promotions:
${promotionList}`,
        },
      ],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return []

    const result = toolUse.input as LLMOpportunityResult

    return result.opportunities
      .filter((o) => o.index >= 0 && o.index < top.length)
      .map((o, rank) => ({
        promotion: top[o.index],
        rationale: o.rationale,
        rank: rank + 1,
      }))
  } catch {
    return []
  }
}
