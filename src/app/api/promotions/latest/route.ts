import { NextResponse } from 'next/server'
import { traceStore } from '@/trace/store'

export async function GET() {
  const latest = traceStore.getLatest()
  if (!latest?.final_plan) {
    return NextResponse.json({ error: 'No plan available yet. POST /api/promotions to generate one.' }, { status: 404 })
  }
  return NextResponse.json(latest.final_plan)
}
