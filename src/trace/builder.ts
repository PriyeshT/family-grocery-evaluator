import { v4 as uuidv4 } from 'uuid'
import type {
  AgentTrace,
  ScrapeStep,
  MatchingStep,
  TraceError,
} from './types'
import type { ShoppingPlan } from '@/types'

type StepName = 'scrape' | 'matching'

export class TraceBuilder {
  private run_id: string
  private triggered_at: string
  private trigger_type: 'manual' | 'scheduled' | 'api'
  private startedAt: number
  private steps: {
    scrape: ScrapeStep | null
    matching: MatchingStep | null
  }
  private errors: TraceError[]
  private warnings: string[]
  private recorded: Set<StepName>
  private finalised: boolean

  constructor(trigger_type: 'manual' | 'scheduled' | 'api' = 'manual') {
    this.run_id = uuidv4()
    this.triggered_at = new Date().toISOString()
    this.trigger_type = trigger_type
    this.startedAt = Date.now()
    this.steps = { scrape: null, matching: null }
    this.errors = []
    this.warnings = []
    this.recorded = new Set()
    this.finalised = false
  }

  getRunId(): string {
    return this.run_id
  }

  recordScrape(step: ScrapeStep): this {
    this.assertNotFinalised()
    this.assertNotRecorded('scrape')
    this.steps.scrape = step
    this.recorded.add('scrape')
    return this
  }

  recordMatching(step: MatchingStep): this {
    this.assertNotFinalised()
    this.assertNotRecorded('matching')
    this.steps.matching = step
    this.recorded.add('matching')
    return this
  }

  addError(error: TraceError): this {
    this.errors.push(error)
    return this
  }

  addWarning(warning: string): this {
    this.warnings.push(warning)
    return this
  }

  finalise(final_plan: ShoppingPlan | null = null): AgentTrace {
    this.assertNotFinalised()
    this.finalised = true
    const trace: AgentTrace = {
      run_id: this.run_id,
      triggered_at: this.triggered_at,
      trigger_type: this.trigger_type,
      duration_ms: Date.now() - this.startedAt,
      steps: this.steps,
      final_plan,
      errors: this.errors,
      warnings: this.warnings,
    }
    return Object.freeze(trace)
  }

  private assertNotFinalised(): void {
    if (this.finalised) throw new Error('TraceBuilder: cannot modify a finalised trace')
  }

  private assertNotRecorded(step: StepName): void {
    if (this.recorded.has(step)) {
      throw new Error(`TraceBuilder: step '${step}' has already been recorded`)
    }
  }
}
