import { NextRequest, NextResponse } from 'next/server'
import { scrapeFairPricePromotions } from '@/tools/scrape-fairprice-promotions'
import { surfaceOpportunities } from '@/tools/surface-opportunities'
import { DEFAULT_SHOPPING_LIST } from '@/lib/shopping-list'
import type { ShoppingListItem } from '@/types'

export async function POST(req: NextRequest) {
  try {
    let shoppingList: ShoppingListItem[] = DEFAULT_SHOPPING_LIST
    try {
      const body = (await req.json()) as { shoppingList?: ShoppingListItem[] }
      if (Array.isArray(body.shoppingList) && body.shoppingList.length > 0) {
        shoppingList = body.shoppingList
      }
    } catch {
      // no body or invalid JSON — use default list
    }

    const { promotions, scrapedAt, usedFallback } = await scrapeFairPricePromotions()
    const opportunities = await surfaceOpportunities(shoppingList, promotions)
    return NextResponse.json({ opportunities, scrapedAt, usedFallback })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
