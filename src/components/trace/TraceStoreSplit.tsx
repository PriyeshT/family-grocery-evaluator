'use client'

import { useState } from 'react'
import type { StoreSplitStep } from '@/trace/types'
import { StepCard } from './StepCard'

interface TraceStoreSplitProps {
  step: StoreSplitStep | null
}

export function TraceStoreSplit({ step }: TraceStoreSplitProps) {
  const [open, setOpen] = useState(false)
  const status = !step ? 'missing' : 'ok'
  const summary = step
    ? `${step.recommendation} · save $${step.estimated_total_savings.toFixed(2)}`
    : 'not run'

  return (
    <StepCard
      title="Store Split"
      status={status}
      summary={summary}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {step && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Recommendation" value={step.recommendation.replace('_', ' ')} />
            <Stat label="Primary store" value={step.primary_store === 'fairprice' ? 'FairPrice' : 'Cold Storage'} />
            <Stat label="Est. savings" value={`$${step.estimated_total_savings.toFixed(2)}`} />
            <Stat label="Threshold" value={`$${step.threshold_applied.toFixed(2)}`} />
          </div>
          <blockquote className="border-l-4 border-indigo-300 pl-4 text-indigo-900 bg-indigo-50 py-2 pr-2 rounded-r">
            {step.reasoning}
          </blockquote>
        </div>
      )}
    </StepCard>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-800 capitalize">{value}</p>
    </div>
  )
}
