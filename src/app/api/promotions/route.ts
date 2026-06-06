import { NextResponse } from 'next/server'
import { runGroceryAgent } from '@/agents/grocery-agent'

export async function POST() {
  try {
    const { plan, trace, usingDemoData } = await runGroceryAgent('api')
    return NextResponse.json({ plan, run_id: trace.run_id, usingDemoData })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
