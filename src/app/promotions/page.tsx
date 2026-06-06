'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PromotionsResult, PromotionsMatchResult, MatchedPromotion, FairPricePromotion, FairPriceSection } from '@/types'
import { SECTION_LABELS, SECTION_ORDER } from '@/types'
import { PromotionCard } from '@/components/promotions/PromotionCard'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'

type ViewMode = 'all' | 'list'

export default function PromotionsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [data, setData] = useState<PromotionsResult | null>(null)
  const [matchData, setMatchData] = useState<PromotionsMatchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<FairPriceSection | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchDeals = useCallback(async (mode: ViewMode) => {
    setLoading(true)
    setError(null)
    try {
      const url = mode === 'list' ? '/api/fairprice-promotions/matched' : '/api/fairprice-promotions'
      const res = await fetch(url)
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      if (mode === 'list') {
        setMatchData((await res.json()) as PromotionsMatchResult)
      } else {
        setData((await res.json()) as PromotionsResult)
      }
      setActiveCategory('All')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDeals(viewMode)
  }, [fetchDeals, viewMode])

  const handleModeSwitch = (mode: ViewMode) => {
    setViewMode(mode)
    setActiveCategory('All')
    setSearchQuery('')
  }

  const basePromotions: FairPricePromotion[] =
    viewMode === 'all'
      ? (data?.promotions ?? [])
      : (matchData?.matched.map((m) => m.promotion) ?? [])

  const presentSections = SECTION_ORDER.filter((s) => basePromotions.some((p) => p.category === s))

  const query = searchQuery.toLowerCase()

  const filteredAll: FairPricePromotion[] =
    viewMode === 'all'
      ? basePromotions.filter(
          (p) =>
            (activeCategory === 'All' || p.category === activeCategory) &&
            (!query || p.name.toLowerCase().includes(query)),
        )
      : []

  const filteredMatched: MatchedPromotion[] =
    viewMode === 'list'
      ? (matchData?.matched ?? []).filter(
          (m) =>
            (activeCategory === 'All' || m.promotion.category === activeCategory) &&
            (!query || m.promotion.name.toLowerCase().includes(query)),
        )
      : []

  const filteredCount = viewMode === 'all' ? filteredAll.length : filteredMatched.length
  const hasContent = !loading && !error

  const scrapedAt = viewMode === 'all' ? data?.scrapedAt : matchData?.scrapedAt
  const usedFallback = viewMode === 'all' ? data?.usedFallback : matchData?.usedFallback

  const lastUpdated = scrapedAt
    ? new Date(scrapedAt).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  const emptyMessage =
    viewMode === 'list' && basePromotions.length === 0
      ? 'None of your shopping list items are currently on promotion.'
      : 'No promotions match your search or filter.'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FairPrice Promotions</h1>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mt-0.5">Last updated: {lastUpdated}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {usedFallback && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                Demo data — live scrape unavailable
              </span>
            )}
            <button
              onClick={() => void fetchDeals(viewMode)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Toggle + Search row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => handleModeSwitch('all')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All promotions
            </button>
            <button
              onClick={() => handleModeSwitch('list')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              On my list
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search promotions…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1.5 text-lg leading-none text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Category filter pills */}
        {hasContent && presentSections.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {(['All', ...presentSections] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {cat === 'All' ? 'All' : SECTION_LABELS[cat]}
                {cat !== 'All' && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({basePromotions.filter((p) => p.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content states */}
        {loading && <LoadingSkeleton />}

        {!loading && error && (
          <ErrorState message={error} onRetry={() => void fetchDeals(viewMode)} />
        )}

        {hasContent && filteredCount === 0 && <EmptyState message={emptyMessage} />}

        {hasContent && filteredCount > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {filteredCount} promotion{filteredCount !== 1 ? 's' : ''}
              {activeCategory !== 'All' ? ` in ${SECTION_LABELS[activeCategory as FairPriceSection]}` : ''}
              {searchQuery ? ` matching "${searchQuery}"` : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {viewMode === 'all'
                ? filteredAll.map((promotion, i) => (
                    <PromotionCard key={`${promotion.name}-${i}`} promotion={promotion} />
                  ))
                : filteredMatched.map((m, i) => (
                    <PromotionCard
                      key={`${m.promotion.name}-${i}`}
                      promotion={m.promotion}
                      matchMethod={m.matchMethod}
                      confidence={m.confidence}
                      shoppingListTerm={m.shoppingListTerm}
                    />
                  ))}
            </div>
          </>
        )}

        {/* Unmatched list items (list mode only) */}
        {hasContent && viewMode === 'list' && matchData && matchData.unmatched.length > 0 && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-600 mb-1">
              Not on promotion ({matchData.unmatched.length}):
            </p>
            <p className="text-sm text-gray-500">{matchData.unmatched.join(', ')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
