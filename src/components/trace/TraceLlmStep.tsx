'use client'

import { useState } from 'react'
import type { LlmStep } from '@/trace/types'

interface TraceLlmStepProps {
  step: LlmStep
}

export function TraceLlmStep({ step }: TraceLlmStepProps) {
  const [open, setOpen] = useState(false)
  const hasReasoning = !!step.reasoning

  return (
    <div className="rounded-lg border border-indigo-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!hasReasoning}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-indigo-50 transition-colors disabled:cursor-default"
      >
        <span className="text-xs font-bold text-indigo-400 tabular-nums shrink-0">
          #{step.step_number}
        </span>
        <span className="text-xs font-mono text-gray-500 truncate min-w-0">{step.model}</span>
        {step.tool_called ? (
          <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium shrink-0">
            {step.tool_called}
          </span>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded shrink-0">
            no tool
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400 tabular-nums shrink-0">
          {step.input_tokens}↑&nbsp;{step.output_tokens}↓
        </span>
        {hasReasoning && (
          <span className="text-gray-400 text-xs shrink-0">{open ? '▲' : '▼'}</span>
        )}
      </button>
      {open && hasReasoning && (
        <div className="px-4 pb-4 pt-3 border-t border-indigo-100">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {step.reasoning}
          </pre>
        </div>
      )}
    </div>
  )
}
