import { describe, it, expect, beforeEach } from 'vitest'
import { TraceBuilder } from '@/trace/builder'
import type { ScrapeStep, MatchingStep } from '@/trace/types'

const mockScrapeStep: ScrapeStep = {
  fairprice: {
    url: 'https://example.com/fp',
    status: 'success',
    items_found: 5,
    duration_ms: 200,
    raw_deals: [],
  },
}

const mockMatchingStep: MatchingStep = {
  shopping_list: [{ term: 'milk' }, { term: 'eggs' }],
  matched: [],
  unmatched: ['eggs'],
  match_methods_used: ['exact'],
}

describe('TraceBuilder', () => {
  let builder: TraceBuilder

  beforeEach(() => {
    builder = new TraceBuilder('manual')
  })

  it('produces a trace with a uuid run_id', () => {
    const trace = builder.finalise()
    expect(trace.run_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it('records trigger type', () => {
    const b = new TraceBuilder('api')
    const trace = b.finalise()
    expect(trace.trigger_type).toBe('api')
  })

  it('records each step correctly', () => {
    builder
      .recordScrape(mockScrapeStep)
      .recordMatching(mockMatchingStep)

    const trace = builder.finalise()
    expect(trace.steps.scrape).toEqual(mockScrapeStep)
    expect(trace.steps.matching).toEqual(mockMatchingStep)
  })

  it('throws if scrape is recorded twice', () => {
    builder.recordScrape(mockScrapeStep)
    expect(() => builder.recordScrape(mockScrapeStep)).toThrow("step 'scrape' has already been recorded")
  })

  it('throws if any step is recorded after finalise', () => {
    builder.finalise()
    expect(() => builder.recordScrape(mockScrapeStep)).toThrow('cannot modify a finalised trace')
  })

  it('duration_ms is non-negative', () => {
    const trace = builder.finalise()
    expect(trace.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('records errors and warnings', () => {
    builder.addError({ step: 'scrape', message: 'timeout' })
    builder.addWarning('low confidence match on rice')
    const trace = builder.finalise()
    expect(trace.errors[0].message).toBe('timeout')
    expect(trace.warnings[0]).toBe('low confidence match on rice')
  })

  it('returned trace is frozen', () => {
    const trace = builder.finalise()
    expect(() => {
      // @ts-expect-error — testing immutability at runtime
      trace.run_id = 'hacked'
    }).toThrow()
  })

  it('unrecorded steps are null', () => {
    const trace = builder.finalise()
    expect(trace.steps.scrape).toBeNull()
    expect(trace.steps.matching).toBeNull()
  })
})
