'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PromotionsResult, FairPricePromotion } from '@/types'
import { PromotionCard } from '@/components/promotions/PromotionCard'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'

export default function PromotionsPage() {
  const [data, setData] = useState<PromotionsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('All')

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/fairprice-promotions')
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const json = (await res.json()) as PromotionsResult
      setData(json)
      setActiveCategory('All')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDeals()
  }, [fetchDeals])

  const categories = data
    ? ['All', ...Array.from(new Set(data.promotions.map((p) => p.category ?? 'Other').filter(Boolean))).sort()]
    : []

  const filtered: FairPricePromotion[] =
    data?.promotions.filter(
      (p) => activeCategory === 'All' || (p.category ?? 'Other') === activeCategory,
    ) ?? []

  const lastUpdated = data?.scrapedAt
    ? new Date(data.scrapedAt).toLocaleString('en-SG', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

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
            {data?.usedFallback && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                Demo data — live scrape unavailable
              </span>
            )}
            <button
              onClick={() => void fetchDeals()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Category filters */}
        {!loading && !error && categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {cat}
                {cat !== 'All' && data && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({data.promotions.filter((p) => (p.category ?? 'Other') === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading && <LoadingSkeleton />}

        {!loading && error && (
          <ErrorState message={error} onRetry={() => void fetchDeals()} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState message="No promotions found for this category." />
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {filtered.length} promotion{filtered.length !== 1 ? 's' : ''}
              {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((promotion, i) => (
                <PromotionCard key={`${promotion.name}-${i}`} promotion={promotion} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
