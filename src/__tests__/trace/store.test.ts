import { describe, it, expect, beforeEach } from 'vitest'
import { TraceStore } from '@/trace/store'
import type { AgentTrace } from '@/trace/types'

function makeTrace(id: string): AgentTrace {
  return Object.freeze({
    run_id: id,
    triggered_at: new Date().toISOString(),
    trigger_type: 'manual',
    duration_ms: 100,
    steps: { scrape: null, matching: null },
    final_plan: null,
    errors: [],
    warnings: [],
  }) as AgentTrace
}

describe('TraceStore', () => {
  let store: TraceStore

  beforeEach(() => {
    store = new TraceStore(3)
  })

  it('getLatest returns null when empty', () => {
    expect(store.getLatest()).toBeNull()
  })

  it('getAll returns empty array when empty', () => {
    expect(store.getAll()).toEqual([])
  })

  it('saves and retrieves the latest trace', () => {
    const t = makeTrace('run-1')
    store.save(t)
    expect(store.getLatest()?.run_id).toBe('run-1')
  })

  it('getAll returns all saved traces in order', () => {
    store.save(makeTrace('run-1'))
    store.save(makeTrace('run-2'))
    const all = store.getAll()
    expect(all).toHaveLength(2)
    expect(all[0].run_id).toBe('run-1')
    expect(all[1].run_id).toBe('run-2')
  })

  it('circular buffer evicts oldest when full', () => {
    store.save(makeTrace('run-1'))
    store.save(makeTrace('run-2'))
    store.save(makeTrace('run-3'))
    store.save(makeTrace('run-4')) // exceeds maxSize=3
    const all = store.getAll()
    expect(all).toHaveLength(3)
    expect(all.map((t) => t.run_id)).toEqual(['run-2', 'run-3', 'run-4'])
  })

  it('getLatest returns most recently saved after eviction', () => {
    store.save(makeTrace('run-1'))
    store.save(makeTrace('run-2'))
    store.save(makeTrace('run-3'))
    store.save(makeTrace('run-4'))
    expect(store.getLatest()?.run_id).toBe('run-4')
  })

  it('getAll returns a copy — mutations do not affect the store', () => {
    store.save(makeTrace('run-1'))
    const all = store.getAll()
    all.push(makeTrace('injected'))
    expect(store.getAll()).toHaveLength(1)
  })
})
