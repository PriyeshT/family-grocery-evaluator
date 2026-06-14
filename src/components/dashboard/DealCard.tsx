import Link from 'next/link'
import type { PlannedItem, FairPriceSection } from '@/types'
import { SECTION_LABELS } from '@/types'

interface DealCardProps {
  item: PlannedItem
}

const STORE_LABEL = 'FairPrice'
const STORE_COLOR = 'bg-brand-secondary/10 border-brand-secondary/30 text-brand-secondary'

const SECTION_ICONS: Record<FairPriceSection, string> = {
  'flash-deals': '⚡',
  'price-slash': '🔖',
  'fresh-picks': '🥦',
  'weekly': '📅',
}

const SECTION_COLORS: Record<FairPriceSection, string> = {
  'flash-deals': 'bg-brand-tertiary/10 text-brand-tertiary border-brand-tertiary/30',
  'price-slash': 'bg-rose-50 text-rose-600 border-rose-200',
  'fresh-picks': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'weekly': 'bg-sky-50 text-sky-700 border-sky-200',
}

export function DealCard({ item }: DealCardProps) {
  const { deal, shopping_list_term, preferredBrand, brandMatched } = item
  const hasSaving = deal.savingPct !== null && deal.savingPct > 0
  const isFairPricePromo = deal.store === 'fairprice' && hasSaving
  const showBrandBadge = preferredBrand !== undefined
  const href = deal.url?.startsWith('http') ? deal.url : `https://www.fairprice.com.sg${deal.url ?? ''}`
  const category = deal.category ?? null

  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-xs text-brand-text-secondary font-medium uppercase tracking-wide">
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
          <p className="text-sm font-medium text-brand-text-primary truncate" title={deal.name}>
            {deal.name}
          </p>
        </div>
        {hasSaving && (
          <span className="flex-shrink-0 text-xs font-bold text-brand-primary bg-brand-accent/30 border border-brand-accent rounded px-1.5 py-0.5">
            -{deal.savingPct}%
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <span className="text-lg font-bold text-brand-text-primary">${deal.salePrice.toFixed(2)}</span>
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

      {category && (
        <div className="mt-2">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${SECTION_COLORS[category]}`}>
            <span aria-hidden>{SECTION_ICONS[category]}</span>
            {SECTION_LABELS[category]}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        {deal.promoLabel && (
          <p className="text-xs text-brand-secondary font-medium">{deal.promoLabel}</p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isFairPricePromo && (
            <Link
              href="/promotions"
              className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-brand-tertiary bg-brand-tertiary/10 border border-brand-tertiary/30 rounded-full px-2.5 py-0.5 hover:bg-brand-tertiary/20 transition-colors"
            >
              <span>On Sale</span>
              <span aria-hidden>→</span>
            </Link>
          )}
          {deal.url && (
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
