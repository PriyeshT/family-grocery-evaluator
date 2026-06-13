import { describe, it, expect, beforeEach } from 'vitest'
import { TraceBuilder } from '@/trace/builder'
import type { ScrapeStep, MatchingStep } from '@/trace/types'

const mockLlmStep = {
  model: 'claude-haiku-4-5-20251001',
  inputTokens: 100,
  outputTokens: 50,
  toolCalled: 'scrape_fairprice_section' as string | null,
  reasoning: 'I will scrape fresh-picks',
}

const mockToolCall = {
  tool: 'scrape_fairprice_section',
  input: { section: 'fresh-picks' } as Record<string, unknown>,
  output: { count: 5 },
  durationMs: 300,
}

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

  it('llm_steps defaults to empty array', () => {
    const trace = builder.finalise()
    expect(trace.llm_steps).toEqual([])
  })

  it('tool_calls defaults to empty array', () => {
    const trace = builder.finalise()
    expect(trace.tool_calls).toEqual([])
  })

  it('total_input_tokens and total_output_tokens are 0 with no llm steps', () => {
    const trace = builder.finalise()
    expect(trace.total_input_tokens).toBe(0)
    expect(trace.total_output_tokens).toBe(0)
  })

  it('recordLlmStep captures step with auto-incremented step_number', () => {
    builder.recordLlmStep(mockLlmStep)
    builder.recordLlmStep({ ...mockLlmStep, inputTokens: 200, outputTokens: 30, toolCalled: null, reasoning: null })
    const trace = builder.finalise()
    expect(trace.llm_steps).toHaveLength(2)
    expect(trace.llm_steps[0].step_number).toBe(0)
    expect(trace.llm_steps[1].step_number).toBe(1)
    expect(trace.llm_steps[0].tool_called).toBe('scrape_fairprice_section')
    expect(trace.llm_steps[1].tool_called).toBeNull()
  })

  it('recordLlmStep maps camelCase params to snake_case fields', () => {
    builder.recordLlmStep(mockLlmStep)
    const trace = builder.finalise()
    const step = trace.llm_steps[0]
    expect(step.input_tokens).toBe(100)
    expect(step.output_tokens).toBe(50)
    expect(step.reasoning).toBe('I will scrape fresh-picks')
  })

  it('recordToolCall captures tool input, output and duration', () => {
    builder.recordToolCall(mockToolCall)
    const trace = builder.finalise()
    expect(trace.tool_calls).toHaveLength(1)
    expect(trace.tool_calls[0].tool).toBe('scrape_fairprice_section')
    expect(trace.tool_calls[0].input).toEqual({ section: 'fresh-picks' })
    expect(trace.tool_calls[0].duration_ms).toBe(300)
  })

  it('total tokens are summed across all llm steps', () => {
    builder.recordLlmStep(mockLlmStep)
    builder.recordLlmStep({ ...mockLlmStep, inputTokens: 200, outputTokens: 30, toolCalled: null, reasoning: null })
    const trace = builder.finalise()
    expect(trace.total_input_tokens).toBe(300)
    expect(trace.total_output_tokens).toBe(80)
  })

  it('recordLlmStep throws after finalise', () => {
    builder.finalise()
    expect(() => builder.recordLlmStep(mockLlmStep)).toThrow('cannot modify a finalised trace')
  })

  it('recordToolCall throws after finalise', () => {
    builder.finalise()
    expect(() => builder.recordToolCall(mockToolCall)).toThrow('cannot modify a finalised trace')
  })
})
