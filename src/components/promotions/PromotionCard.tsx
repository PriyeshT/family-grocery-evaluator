import type { FairPricePromotion, DealHistoryStats } from '@/types'
import { SECTION_LABELS } from '@/types'

interface PromotionCardProps {
  promotion: FairPricePromotion
  matchMethod?: 'exact' | 'fuzzy' | 'llm'
  confidence?: number
  shoppingListTerm?: string
  isOnList?: boolean
  wasJustAdded?: boolean
  onAddToList?: () => void
  dealHistory?: DealHistoryStats
}

export function PromotionCard({ promotion, matchMethod, confidence, shoppingListTerm, isOnList, wasJustAdded, onAddToList, dealHistory }: PromotionCardProps) {
  const hasSaving = promotion.savingPct !== null && promotion.savingPct > 0
  const href = promotion.url?.startsWith('http') ? promotion.url : `https://www.fairprice.com.sg${promotion.url ?? ''}`

  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 leading-snug flex-1 min-w-0">
          {promotion.name}
        </p>
        {hasSaving && (
          <span className="flex-shrink-0 text-xs font-bold text-brand-primary bg-brand-accent/30 border border-brand-accent rounded px-1.5 py-0.5">
            -{promotion.savingPct}%
          </span>
        )}
      </div>

      {matchMethod && (
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium rounded-full px-2 py-0.5 ${
              matchMethod === 'exact'
                ? 'bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/30'
                : matchMethod === 'llm'
                  ? 'bg-violet-50 text-violet-700 border border-violet-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {matchMethod === 'exact'
              ? 'Exact match'
              : matchMethod === 'llm'
                ? `AI match · ${Math.round((confidence ?? 0) * 100)}%`
                : `Fuzzy match · ${Math.round((confidence ?? 0) * 100)}%`}
          </span>
          {shoppingListTerm && (
            <span className="text-xs text-brand-text-secondary">for &ldquo;{shoppingListTerm}&rdquo;</span>
          )}
        </div>
      )}

      <div className="flex items-end justify-between">
        <div>
          <span className="text-xl font-bold text-gray-900">
            ${promotion.salePrice.toFixed(2)}
          </span>
          {promotion.originalPrice !== null && (
            <span className="ml-2 text-sm text-gray-400 line-through">
              ${promotion.originalPrice.toFixed(2)}
            </span>
          )}
        </div>
        {promotion.savingAmount !== null && promotion.savingAmount > 0 && (
          <span className="text-xs text-brand-secondary font-medium">
            Save ${promotion.savingAmount.toFixed(2)}
          </span>
        )}
      </div>

      {dealHistory && (
        <div className="flex flex-wrap gap-1.5">
          {dealHistory.weeksOnPromotion >= 2 && (
            <span className="text-xs font-medium text-brand-primary bg-brand-primary/10 border border-brand-primary/20 rounded px-1.5 py-0.5">
              On sale {dealHistory.weeksOnPromotion} week{dealHistory.weeksOnPromotion !== 1 ? 's' : ''}
            </span>
          )}
          {dealHistory.isLowestPrice && (
            <span className="text-xs font-medium text-brand-primary bg-brand-accent/30 border border-brand-accent rounded px-1.5 py-0.5">
              Best price in {dealHistory.lowestPriceWindowWeeks} week{dealHistory.lowestPriceWindowWeeks !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {promotion.category && (
            <span className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">
              {SECTION_LABELS[promotion.category]}
            </span>
          )}
          {promotion.promoLabel && (
            <span className="text-xs text-brand-secondary font-medium">{promotion.promoLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOnList ? (
            <span className="px-3 py-1.5 text-xs font-medium text-brand-secondary bg-brand-secondary/10 border border-brand-secondary/30 rounded-md">
              On your list
            </span>
          ) : wasJustAdded ? (
            <span className="px-3 py-1.5 text-xs font-medium text-brand-secondary bg-brand-secondary/10 border border-brand-secondary/30 rounded-md">
              Added
            </span>
          ) : onAddToList ? (
            <button
              onClick={onAddToList}
              className="px-3 py-1.5 bg-brand-bg hover:bg-brand-border text-brand-text-secondary text-xs font-medium rounded-md transition-colors"
            >
              + Add to list
            </button>
          ) : null}
          {promotion.url && (
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
}
