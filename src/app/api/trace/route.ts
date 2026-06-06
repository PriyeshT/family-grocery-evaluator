import { NextResponse } from 'next/server'
import { traceStore } from '@/trace/store'

export async function GET() {
  return NextResponse.json(traceStore.getAll())
}
