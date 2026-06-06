import type { StoreSplitRecommendation } from '@/types'

interface StoreSplitCardProps {
  recommendation: StoreSplitRecommendation
}

const STORE_LABELS: Record<string, string> = {
  fairprice: 'FairPrice',
  coldstorage: 'Cold Storage',
}

export function StoreSplitCard({ recommendation }: StoreSplitCardProps) {
  const isSplit = recommendation.recommendation === 'split'

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-indigo-500" />
        <h2 className="text-sm font-semibold text-indigo-800 uppercase tracking-wide">
          Shopping Recommendation
        </h2>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="inline-flex items-center gap-1 text-sm font-medium bg-white border border-indigo-200 text-indigo-700 rounded-full px-3 py-1">
          {isSplit ? '🛒 Split shop' : '🏪 Single store'}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-medium bg-white border border-indigo-200 text-indigo-700 rounded-full px-3 py-1">
          {STORE_LABELS[recommendation.primary_store]}
          {isSplit && recommendation.split_store ? ` + ${STORE_LABELS[recommendation.split_store]}` : ''}
        </span>
        {recommendation.estimated_total_savings > 0 && (
          <span className="inline-flex items-center gap-1 text-sm font-medium bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-full px-3 py-1">
            Save ${recommendation.estimated_total_savings.toFixed(2)}
          </span>
        )}
      </div>

      <blockquote className="border-l-4 border-indigo-300 pl-4 text-sm text-indigo-900">
        {recommendation.reasoning}
      </blockquote>
    </div>
  )
}
