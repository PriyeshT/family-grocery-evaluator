'use client'

import { useState } from 'react'
import type { ComparisonStep } from '@/trace/types'
import { StepCard } from './StepCard'

interface TraceComparisonStepProps {
  step: ComparisonStep | null
}

export function TraceComparisonStep({ step }: TraceComparisonStepProps) {
  const [open, setOpen] = useState(false)
  const status = !step ? 'missing' : 'ok'
  const summary = step
    ? `${step.items_compared.length} items compared, ${step.items_single_store.length} single-store`
    : 'not run'

  return (
    <StepCard
      title="Price Comparison"
      status={status}
      summary={summary}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {step && (
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase">
              <th className="py-1 pr-3">Item</th>
              <th className="py-1 pr-3">FairPrice</th>
              <th className="py-1 pr-3">Cold Storage</th>
              <th className="py-1 pr-3">Winner</th>
              <th className="py-1">Saving</th>
            </tr>
          </thead>
          <tbody>
            {step.items_compared.map((c) => (
              <tr key={c.item_name} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 font-medium">{c.item_name}</td>
                <td className="py-1.5 pr-3 font-mono text-xs">
                  {c.fairprice_deal ? `$${c.fairprice_deal.salePrice.toFixed(2)}` : '—'}
                </td>
                <td className="py-1.5 pr-3 font-mono text-xs">
                  {c.coldstorage_deal ? `$${c.coldstorage_deal.salePrice.toFixed(2)}` : '—'}
                </td>
                <td className="py-1.5 pr-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.winner === 'fairprice' ? 'bg-blue-100 text-blue-700' : c.winner === 'coldstorage' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {c.winner === 'fairprice' ? 'FairPrice' : c.winner === 'coldstorage' ? 'Cold Storage' : '—'}
                  </span>
                </td>
                <td className="py-1.5 font-mono text-xs text-emerald-700">
                  {c.saving_amount > 0 ? `$${c.saving_amount.toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </StepCard>
  )
}
