'use client'

import { useState } from 'react'
import type { MatchingStep } from '@/trace/types'
import { StepCard } from './StepCard'

interface TraceMatchingStepProps {
  step: MatchingStep | null
}

export function TraceMatchingStep({ step }: TraceMatchingStepProps) {
  const [open, setOpen] = useState(false)
  const hasUnmatched = (step?.unmatched.length ?? 0) > 0
  const status = !step ? 'missing' : hasUnmatched ? 'warn' : 'ok'
  const summary = step
    ? `${step.matched.length} matched, ${step.unmatched.length} unmatched`
    : 'not run'

  return (
    <StepCard
      title="Matching"
      status={status}
      summary={summary}
      open={open}
      onToggle={() => setOpen((v) => !v)}
    >
      {step && (
        <div className="space-y-3 text-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase">
                <th className="py-1 pr-3">Shopping list</th>
                <th className="py-1 pr-3">Matched deal</th>
                <th className="py-1 pr-3">Method</th>
                <th className="py-1">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {step.matched.map((m) => (
                <tr key={m.shopping_list_term} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 font-medium">{m.shopping_list_term}</td>
                  <td className="py-1.5 pr-3 text-gray-700">{m.matched_deal.name}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${m.match_method === 'exact' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {m.match_method}
                    </span>
                  </td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${m.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{Math.round(m.confidence * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {step.unmatched.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-amber-700 font-medium">Unmatched:</span>
              {step.unmatched.map((u) => (
                <span key={u} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                  {u}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </StepCard>
  )
}
