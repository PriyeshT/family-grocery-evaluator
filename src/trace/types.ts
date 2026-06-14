import type { RawDeal, ShoppingPlan, FairPriceSection } from '@/types'

export interface LlmStep {
  step_number: number
  model: string
  input_tokens: number
  output_tokens: number
  tool_called: string | null
  reasoning: string | null
}

export interface ToolCallRecord {
  tool: string
  input: Record<string, unknown>
  output: unknown
  duration_ms: number
}

export interface AgentTrace {
  run_id: string
  triggered_at: string
  trigger_type: 'manual' | 'scheduled' | 'api'
  duration_ms: number
  steps: TraceSteps
  llm_steps: LlmStep[]
  tool_calls: ToolCallRecord[]
  total_input_tokens: number
  total_output_tokens: number
  final_plan: ShoppingPlan | null
  errors: TraceError[]
  warnings: string[]
}

export interface TraceSteps {
  scrape: ScrapeStep | null
  matching: MatchingStep | null
}

export interface ScrapeStep {
  fairprice: ScrapeSummary
}

export interface SectionScrapeResult {
  section: FairPriceSection
  items_found: number
  duration_ms: number
  status: 'success' | 'fallback_used' | 'failed'
  error?: string
}

export interface ScrapeSummary {
  url: string
  status: 'success' | 'failed' | 'fallback_used'
  items_found: number
  duration_ms: number
  raw_deals: RawDeal[]
  error?: string
  sections_selected?: FairPriceSection[]
  section_results?: SectionScrapeResult[]
}

export interface MatchingStep {
  shopping_list: import('@/types').ShoppingListItem[]
  matched: MatchedItem[]
  unmatched: string[]
  match_methods_used: Array<'exact' | 'fuzzy' | 'none'>
}

export interface MatchedItem {
  shopping_list_term: string
  matched_deal: RawDeal
  match_method: 'exact' | 'fuzzy' | 'none'
  confidence: number
  preferredBrand?: string
  brandMatched?: boolean
}

export interface TraceError {
  step: 'scrape' | 'matching' | 'agent'
  message: string
  details?: string
}
