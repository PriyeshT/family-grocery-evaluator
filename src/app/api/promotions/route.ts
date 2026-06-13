import { NextResponse } from 'next/server'
import { runGroceryAgent } from '@/agents/grocery-agent'
import { traceStore } from '@/trace/store'
import { config } from '@/lib/config'
import type { ShoppingListItem } from '@/types'

function hashList(list: ShoppingListItem[]): string {
  const canonical = [...list]
    .sort((a, b) => a.term.localeCompare(b.term))
    .map(item => `${item.term}|${item.preferredBrand ?? ''}`)
  return canonical.join(',')
}

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

    const latest = traceStore.getLatest()
    if (latest && latest.final_plan && latest.steps.matching?.shopping_list) {
      const ageMs = Date.now() - new Date(latest.triggered_at).getTime()
      const incomingHash = shoppingList ? hashList(shoppingList) : hashList(latest.steps.matching.shopping_list)
      const cachedHash = hashList(latest.steps.matching.shopping_list)
      if (ageMs < config.agentCacheMaxAgeMs && incomingHash === cachedHash) {
        return NextResponse.json({
          plan: latest.final_plan,
          run_id: latest.run_id,
          usingDemoData: false,
          cached: true,
        })
      }
    }

    const { plan, trace, usingDemoData } = await runGroceryAgent('api', shoppingList)
    return NextResponse.json({ plan, run_id: trace.run_id, usingDemoData, cached: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
