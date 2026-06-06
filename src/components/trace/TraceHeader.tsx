import type { AgentTrace } from '@/trace/types'

interface TraceHeaderProps {
  trace: AgentTrace
}

const STATUS_COLORS = {
  ok: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-100 text-amber-700 border-amber-200',
  error: 'bg-red-100 text-red-700 border-red-200',
}

export function TraceHeader({ trace }: TraceHeaderProps) {
  const hasErrors = trace.errors.length > 0
  const hasWarnings = trace.warnings.length > 0
  const statusKey = hasErrors ? 'error' : hasWarnings ? 'warn' : 'ok'
  const statusLabel = hasErrors ? 'Errors' : hasWarnings ? 'Warnings' : 'OK'

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-200">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">Run ID</p>
        <p className="font-mono text-xs text-gray-800 truncate">{trace.run_id}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500">Triggered</p>
        <p className="text-xs text-gray-800">{new Date(trace.triggered_at).toLocaleString()}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500">Duration</p>
        <p className="text-xs text-gray-800 font-mono">{trace.duration_ms}ms</p>
      </div>
      <div>
        <p className="text-xs text-gray-500">Trigger</p>
        <p className="text-xs text-gray-800 capitalize">{trace.trigger_type}</p>
      </div>
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[statusKey]}`}
      >
        {statusLabel}
      </span>
    </div>
  )
}
