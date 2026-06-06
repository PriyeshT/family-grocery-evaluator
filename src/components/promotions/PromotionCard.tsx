'use client'

import { useState } from 'react'
import type { FairPricePromotion } from '@/types'
import { SECTION_LABELS } from '@/types'

interface PromotionCardProps {
  promotion: FairPricePromotion
  matchMethod?: 'exact' | 'fuzzy'
  confidence?: number
  shoppingListTerm?: string
}

function extractProductId(url: string | null): string | null {
  if (!url) return null
  try {
    const pathname = new URL(url, 'https://www.fairprice.com.sg').pathname
    const match = pathname.match(/-(\d+)$/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

type AddStatus = 'idle' | 'loading' | 'success' | 'error'

export function PromotionCard({ promotion, matchMethod, confidence, shoppingListTerm }: PromotionCardProps) {
  const [addStatus, setAddStatus] = useState<AddStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const hasSaving = promotion.savingPct !== null && promotion.savingPct > 0
  const href = promotion.url?.startsWith('http') ? promotion.url : `https://www.fairprice.com.sg${promotion.url ?? ''}`
  const productId = extractProductId(promotion.url)

  const handleAddToList = async () => {
    if (!productId || addStatus === 'loading' || addStatus === 'success') return
    setAddStatus('loading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/fairprice-wishlist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      setAddStatus('success')
    } catch (err) {
      setAddStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add')
    }
  }

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

      {/* Add to FairPrice shopping list */}
      <div className="flex flex-col gap-1">
        <button
          onClick={() => void handleAddToList()}
          disabled={!productId || addStatus === 'loading' || addStatus === 'success'}
          title={!productId ? 'Product ID not available (mock data)' : undefined}
          className={`w-full py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
            addStatus === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
              : addStatus === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                : !productId
                  ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
          }`}
        >
          {addStatus === 'loading' && 'Adding…'}
          {addStatus === 'success' && '✓ Added to FairPrice list'}
          {addStatus === 'error' && 'Retry — add to list'}
          {addStatus === 'idle' && (productId ? '+ Add to FairPrice list' : '+ Add to list (no product ID)')}
        </button>
        {addStatus === 'error' && errorMsg && (
          <p className="text-xs text-red-500 text-center">{errorMsg}</p>
        )}
      </div>
    </div>
  )
}
