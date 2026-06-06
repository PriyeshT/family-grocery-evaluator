import type { TraceError } from '@/trace/types'

interface TraceErrorsProps {
  errors: TraceError[]
  warnings: string[]
}

export function TraceErrors({ errors, warnings }: TraceErrorsProps) {
  if (errors.length === 0 && warnings.length === 0) return null

  return (
    <div className="space-y-2 mt-2">
      {errors.map((e, i) => (
        <div key={i} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm">
          <span className="font-medium text-red-700 capitalize">{e.step}: </span>
          <span className="text-red-600">{e.message}</span>
          {e.details && <p className="text-red-500 text-xs mt-0.5">{e.details}</p>}
        </div>
      ))}
      {warnings.map((w, i) => (
        <div key={i} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          ⚠ {w}
        </div>
      ))}
    </div>
  )
}
