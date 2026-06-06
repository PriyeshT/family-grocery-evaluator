import type { RawDeal, ShoppingPlan } from '@/types'

export interface AgentTrace {
  run_id: string
  triggered_at: string
  trigger_type: 'manual' | 'scheduled' | 'api'
  duration_ms: number
  steps: TraceSteps
  final_plan: ShoppingPlan | null
  errors: TraceError[]
  warnings: string[]
}

export interface TraceSteps {
  scrape: ScrapeStep | null
  matching: MatchingStep | null
  comparison: ComparisonStep | null
  store_split: StoreSplitStep | null
}

export interface ScrapeStep {
  fairprice: ScrapeSummary
  coldstorage: ScrapeSummary
}

export interface ScrapeSummary {
  url: string
  status: 'success' | 'failed' | 'fallback_used'
  items_found: number
  duration_ms: number
  raw_deals: RawDeal[]
  error?: string
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

export interface ComparisonStep {
  items_compared: ComparedItem[]
  items_single_store: string[]
}

export interface ComparedItem {
  item_name: string
  fairprice_deal: RawDeal | null
  coldstorage_deal: RawDeal | null
  winner: 'fairprice' | 'coldstorage' | 'no_deal'
  saving_amount: number
  saving_pct: number
}

export interface StoreSplitStep {
  recommendation: 'single_store' | 'split'
  primary_store: 'fairprice' | 'coldstorage'
  split_store: 'fairprice' | 'coldstorage' | null
  estimated_total_savings: number
  threshold_applied: number
  reasoning: string
}

export interface TraceError {
  step: 'scrape' | 'matching' | 'comparison' | 'store_split' | 'agent'
  message: string
  details?: string
}
