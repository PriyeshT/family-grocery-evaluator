import { NextResponse } from 'next/server'
import { scrapeFairPricePromotions } from '@/tools/scrape-fairprice-promotions'
import { matchPromotionsToList } from '@/tools/match-promotions'
import { SHOPPING_LIST } from '@/lib/shopping-list'

export async function GET() {
  try {
    const { promotions, scrapedAt, usedFallback } = await scrapeFairPricePromotions()
    const { matched, unmatched } = matchPromotionsToList(SHOPPING_LIST, promotions)
    return NextResponse.json({ matched, unmatched, scrapedAt, usedFallback })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
