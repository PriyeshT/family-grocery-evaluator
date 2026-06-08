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
    : step.fairprice.status === 'failed'
      ? 'error'
      : step.fairprice.status === 'fallback_used'
        ? 'warn'
        : 'ok'

  const total = step ? step.fairprice.items_found : 0

  return (
    <StepCard
      title="Scrape"
      status={status}
      summary={`${total} deals found`}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {step && (
        <div className="text-sm">
          <div className="rounded border border-gray-200 p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">FairPrice</span>
              <StatusBadge status={step.fairprice.status} />
            </div>
            <p className="text-gray-500 text-xs font-mono truncate">{step.fairprice.url}</p>
            <p className="text-gray-700 mt-1">{step.fairprice.items_found} items · {step.fairprice.duration_ms}ms</p>
            {step.fairprice.error && <p className="text-amber-600 text-xs mt-1">{step.fairprice.error}</p>}
          </div>
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
