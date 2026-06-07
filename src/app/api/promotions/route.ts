import { NextResponse } from 'next/server'
import { runGroceryAgent } from '@/agents/grocery-agent'
import type { ShoppingListItem } from '@/types'

export async function POST(req: Request) {
  try {
    let shoppingList: ShoppingListItem[] | undefined
    try {
      const body = await req.json() as { shoppingList?: ShoppingListItem[] }
      if (Array.isArray(body.shoppingList) && body.shoppingList.length > 0) {
        shoppingList = body.shoppingList
      }
    } catch {
      // no body or invalid JSON — use default
    }

    const { plan, trace, usingDemoData } = await runGroceryAgent('api', shoppingList)
    return NextResponse.json({ plan, run_id: trace.run_id, usingDemoData })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
