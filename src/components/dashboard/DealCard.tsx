import Link from 'next/link'
import type { PlannedItem } from '@/types'

interface DealCardProps {
  item: PlannedItem
}

const STORE_LABEL = 'FairPrice'
const STORE_COLOR = 'bg-blue-50 border-blue-200 text-blue-700'

export function DealCard({ item }: DealCardProps) {
  const { deal, shopping_list_term, preferredBrand, brandMatched } = item
  const hasSaving = deal.savingPct !== null && deal.savingPct > 0
  const isFairPricePromo = deal.store === 'fairprice' && hasSaving
  const showBrandBadge = preferredBrand !== undefined

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              {shopping_list_term}
            </p>
            {showBrandBadge && brandMatched && (
              <span className="text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-1.5 py-0">
                {preferredBrand} ✓
              </span>
            )}
            {showBrandBadge && !brandMatched && (
              <span
                className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0"
                title={`${preferredBrand} not on sale — showing best available`}
              >
                {preferredBrand} not on sale
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 truncate" title={deal.name}>
            {deal.name}
          </p>
        </div>
        {hasSaving && (
          <span className="flex-shrink-0 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
            -{deal.savingPct}%
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <span className="text-lg font-bold text-gray-900">${deal.salePrice.toFixed(2)}</span>
          {deal.originalPrice && (
            <span className="ml-2 text-sm text-gray-400 line-through">
              ${deal.originalPrice.toFixed(2)}
            </span>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STORE_COLOR}`}>
          {STORE_LABEL}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        {deal.promoLabel && (
          <p className="text-xs text-emerald-600 font-medium">{deal.promoLabel}</p>
        )}
        {isFairPricePromo && (
          <Link
            href="/promotions"
            className="ml-auto flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-0.5 hover:bg-orange-100 transition-colors"
          >
            <span>On Sale</span>
            <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </div>
  )
}
