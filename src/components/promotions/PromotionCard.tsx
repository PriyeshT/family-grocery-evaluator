import type { FairPricePromotion } from '@/types'
import { SECTION_LABELS } from '@/types'

interface PromotionCardProps {
  promotion: FairPricePromotion
  matchMethod?: 'exact' | 'fuzzy'
  confidence?: number
  shoppingListTerm?: string
}

export function PromotionCard({ promotion, matchMethod, confidence, shoppingListTerm }: PromotionCardProps) {
  const hasSaving = promotion.savingPct !== null && promotion.savingPct > 0
  const href = promotion.url?.startsWith('http') ? promotion.url : `https://www.fairprice.com.sg${promotion.url ?? ''}`

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 leading-snug flex-1 min-w-0">
          {promotion.name}
        </p>
        {hasSaving && (
          <span className="flex-shrink-0 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
            -{promotion.savingPct}%
          </span>
        )}
      </div>

      {matchMethod && (
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium rounded-full px-2 py-0.5 ${
              matchMethod === 'exact'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {matchMethod === 'exact' ? 'Exact match' : `Fuzzy match · ${Math.round((confidence ?? 0) * 100)}%`}
          </span>
          {shoppingListTerm && (
            <span className="text-xs text-gray-400">for &ldquo;{shoppingListTerm}&rdquo;</span>
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
          <span className="text-xs text-emerald-600 font-medium">
            Save ${promotion.savingAmount.toFixed(2)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {promotion.category && (
            <span className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-0.5">
              {SECTION_LABELS[promotion.category]}
            </span>
          )}
          {promotion.promoLabel && (
            <span className="text-xs text-blue-600 font-medium">{promotion.promoLabel}</span>
          )}
        </div>
        {promotion.url && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
          >
            View →
          </a>
        )}
      </div>
    </div>
  )
}
