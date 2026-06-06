import { NextResponse } from 'next/server'
import { scrapeFairPricePromotions } from '@/tools/scrape-fairprice-promotions'

export async function GET() {
  try {
    const result = await scrapeFairPricePromotions()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
