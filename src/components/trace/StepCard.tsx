'use client'

import type { ReactNode } from 'react'

interface StepCardProps {
  title: string
  status: 'ok' | 'warn' | 'error' | 'missing'
  summary: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

const STATUS_ICON: Record<string, string> = {
  ok: '✓',
  warn: '⚠',
  error: '✗',
  missing: '—',
}

const STATUS_COLOR: Record<string, string> = {
  ok: 'text-emerald-600',
  warn: 'text-amber-500',
  error: 'text-red-600',
  missing: 'text-gray-400',
}

export function StepCard({ title, status, summary, open, onToggle, children }: StepCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={`text-sm font-bold ${STATUS_COLOR[status]}`}>{STATUS_ICON[status]}</span>
        <span className="font-medium text-gray-800 text-sm">{title}</span>
        <span className="text-xs text-gray-500 ml-1">{summary}</span>
        <span className="ml-auto text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-100">{children}</div>}
    </div>
  )
}
