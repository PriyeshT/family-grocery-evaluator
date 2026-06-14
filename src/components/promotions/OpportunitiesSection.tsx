'use client'

import type { OpportunityItem } from '@/types'
import { SECTION_LABELS } from '@/types'

interface OpportunitiesSectionProps {
  opportunities: OpportunityItem[]
  loading: boolean
  error: string | null
  addedNames: Set<string>
  listTerms: Set<string>
  onAddToList: (name: string) => void
  onRetry: () => void
}

export function OpportunitiesSection({
  opportunities,
  loading,
  error,
  addedNames,
  listTerms,
  onAddToList,
  onRetry,
}: OpportunitiesSectionProps) {
  return (
    <div className="mt-10 pt-8 border-t border-gray-200">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">✨</span>
        <h2 className="text-lg font-bold text-brand-primary">Worth adding this week</h2>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
          AI picks
        </span>
      </div>
      <p className="text-sm text-brand-text-secondary mb-5 ml-8">
        Deals on items not on your list — curated based on savings and household staples.
      </p>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-brand-border bg-brand-surface p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-amber-800">Could not load AI suggestions: {error}</p>
          <button
            onClick={onRetry}
            className="ml-4 text-sm font-medium text-amber-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && opportunities.length === 0 && (
        <div className="rounded-lg border border-brand-border bg-brand-bg px-4 py-6 text-center">
          <p className="text-sm text-brand-text-secondary">No additional opportunities found this week — your list already covers the best deals!</p>
        </div>
      )}

      {!loading && !error && opportunities.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {opportunities.map((item) => {
            const onList = listTerms.has(item.promotion.name.toLowerCase())
            const justAdded = addedNames.has(item.promotion.name)
            const href = item.promotion.url?.startsWith('http')
              ? item.promotion.url
              : `https://www.fairprice.com.sg${item.promotion.url ?? ''}`

            return (
              <div
                key={item.promotion.name}
                className="rounded-lg border border-brand-border bg-brand-surface p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 leading-snug flex-1 min-w-0">
                    {item.promotion.name}
                  </p>
                  {item.promotion.savingPct != null && item.promotion.savingPct > 0 && (
                    <span className="flex-shrink-0 text-xs font-bold text-brand-primary bg-brand-accent/30 border border-brand-accent rounded px-1.5 py-0.5">
                      -{item.promotion.savingPct}%
                    </span>
                  )}
                </div>

                <p className="text-xs text-violet-700 bg-violet-50 rounded px-2.5 py-1.5 leading-relaxed">
                  {item.rationale}
                </p>

                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-xl font-bold text-gray-900">
                      ${item.promotion.salePrice.toFixed(2)}
                    </span>
                    {item.promotion.originalPrice !== null && (
                      <span className="ml-2 text-sm text-gray-400 line-through">
                        ${item.promotion.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {item.promotion.savingAmount !== null && item.promotion.savingAmount > 0 && (
                    <span className="text-xs text-brand-secondary font-medium">
                      Save ${item.promotion.savingAmount.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  <div>
                    {item.promotion.category && (
                      <span className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">
                        {SECTION_LABELS[item.promotion.category]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {onList || justAdded ? (
                      <span className="px-3 py-1.5 text-xs font-medium text-brand-secondary bg-brand-secondary/10 border border-brand-secondary/30 rounded-md">
                        {justAdded ? 'Added' : 'On your list'}
                      </span>
                    ) : (
                      <button
                        onClick={() => onAddToList(item.promotion.name)}
                        className="px-3 py-1.5 bg-brand-secondary hover:bg-brand-secondary/90 text-white text-xs font-medium rounded-md transition-colors"
                      >
                        + Add to list
                      </button>
                    )}
                    {item.promotion.url && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-brand-tertiary hover:bg-brand-tertiary/90 text-white text-xs font-medium rounded-md transition-colors"
                      >
                        View →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
