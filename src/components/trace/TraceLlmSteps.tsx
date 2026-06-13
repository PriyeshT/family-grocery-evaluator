import type { LlmStep } from '@/trace/types'
import { TraceLlmStep } from './TraceLlmStep'

interface TraceLlmStepsProps {
  steps: LlmStep[]
  totalInputTokens: number
  totalOutputTokens: number
}

export function TraceLlmSteps({ steps, totalInputTokens, totalOutputTokens }: TraceLlmStepsProps) {
  if (steps.length === 0) return null

  const totalTokens = totalInputTokens + totalOutputTokens

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-indigo-200">
        <span className="text-indigo-500 text-sm leading-none">✦</span>
        <span className="text-sm font-semibold text-indigo-700">LLM Reasoning</span>
        <span className="ml-auto text-xs text-indigo-500">
          {steps.length} {steps.length === 1 ? 'step' : 'steps'} · {totalTokens.toLocaleString()} tokens total
        </span>
      </div>
      <div className="p-3 space-y-2">
        {steps.map((step) => (
          <TraceLlmStep key={step.step_number} step={step} />
        ))}
      </div>
      <div className="px-4 py-2 border-t border-indigo-200 flex gap-4 text-xs text-indigo-600">
        <span>Input: {totalInputTokens.toLocaleString()}</span>
        <span>Output: {totalOutputTokens.toLocaleString()}</span>
      </div>
    </div>
  )
}
