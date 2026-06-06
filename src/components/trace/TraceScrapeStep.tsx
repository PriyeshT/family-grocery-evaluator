'use client'

import { useState } from 'react'
import type { ScrapeStep } from '@/trace/types'
import { StepCard } from './StepCard'

interface TraceScrapeStepProps {
  step: ScrapeStep | null
}

export function TraceScrapeStep({ step }: TraceScrapeStepProps) {
  const [open, setOpen] = useState(false)

  const status = !step
    ? 'missing'
    : step.fairprice.status === 'failed' || step.coldstorage.status === 'failed'
      ? 'error'
      : step.fairprice.status === 'fallback_used' || step.coldstorage.status === 'fallback_used'
        ? 'warn'
        : 'ok'

  const total = step ? step.fairprice.items_found + step.coldstorage.items_found : 0

  return (
    <StepCard
      title="Scrape"
      status={status}
      summary={`${total} deals found`}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {step && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {(['fairprice', 'coldstorage'] as const).map((store) => {
            const s = step[store]
            return (
              <div key={store} className="rounded border border-gray-200 p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium capitalize">{store === 'fairprice' ? 'FairPrice' : 'Cold Storage'}</span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-gray-500 text-xs font-mono truncate">{s.url}</p>
                <p className="text-gray-700 mt-1">{s.items_found} items · {s.duration_ms}ms</p>
                {s.error && <p className="text-amber-600 text-xs mt-1">{s.error}</p>}
              </div>
            )
          })}
        </div>
      )}
    </StepCard>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: 'bg-emerald-100 text-emerald-700',
    fallback_used: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
