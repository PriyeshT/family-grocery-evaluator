import { NextResponse } from 'next/server'
import { scrapeFairPricePromotions } from '@/tools/scrape-fairprice-promotions'
import { addSnapshots, getStatsForAll } from '@/lib/deal-history-store'

export async function GET() {
  try {
    const result = await scrapeFairPricePromotions()

    await addSnapshots(result.promotions, 'fairprice', result.scrapedAt)

    const names = result.promotions.map((p) => p.name)
    const dealHistoryByName = await getStatsForAll(names)

    return NextResponse.json({ ...result, dealHistoryByName })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
