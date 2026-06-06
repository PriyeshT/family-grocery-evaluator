import { NextResponse } from 'next/server'
import { traceStore } from '@/trace/store'

export async function GET() {
  const latest = traceStore.getLatest()
  if (!latest) {
    return NextResponse.json({ error: 'No trace available yet. POST /api/promotions to run the agent.' }, { status: 404 })
  }
  return NextResponse.json(latest)
}
