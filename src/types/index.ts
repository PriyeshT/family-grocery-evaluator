export interface ShoppingListItem {
  term: string
  preferredBrand?: string
}

export interface RawDeal {
  name: string
  store: 'fairprice'
  salePrice: number
  originalPrice: number | null
  savingAmount: number | null
  savingPct: number | null
  url: string | null
  promoLabel: string | null
}

export interface ShoppingPlan {
  run_id: string
  generated_at: string
  items: PlannedItem[]
  unmatched_items: string[]
  estimated_total: number
  estimated_savings: number
}

export interface PlannedItem {
  shopping_list_term: string
  deal: RawDeal
  store: 'fairprice'
  preferredBrand?: string
  brandMatched?: boolean
}

export type FairPriceSection = 'flash-deals' | 'price-slash' | 'fresh-picks' | 'weekly'

export const SECTION_LABELS: Record<FairPriceSection, string> = {
  'flash-deals': 'Flash Deals',
  'price-slash': 'Price Slash Zone',
  'fresh-picks': 'Fresh Picks',
  'weekly': 'Weekly Promotions',
}

export const SECTION_ORDER: FairPriceSection[] = ['flash-deals', 'price-slash', 'fresh-picks', 'weekly']

export interface FairPricePromotion {
  name: string
  salePrice: number
  originalPrice: number | null
  savingAmount: number | null
  savingPct: number | null
  promoLabel: string | null
  category: FairPriceSection | null
  imageUrl: string | null
  url: string | null
  validUntil: string | null
}

export interface PromotionsResult {
  promotions: FairPricePromotion[]
  scrapedAt: string
  usedFallback: boolean
  error?: string
}

export interface MatchedPromotion {
  shoppingListTerm: string
  promotion: FairPricePromotion
  matchMethod: 'exact' | 'fuzzy' | 'llm'
  confidence: number
  brandFound?: boolean
  alternatives?: FairPricePromotion[]
}

export interface PromotionsMatchResult {
  matched: MatchedPromotion[]
  unmatched: string[]
  scrapedAt: string
  usedFallback: boolean
}
