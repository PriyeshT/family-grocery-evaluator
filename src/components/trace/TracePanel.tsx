import type { AgentTrace } from '@/trace/types'
import { TraceHeader } from './TraceHeader'
import { TraceScrapeStep } from './TraceScrapeStep'
import { TraceMatchingStep } from './TraceMatchingStep'
import { TraceComparisonStep } from './TraceComparisonStep'
import { TraceStoreSplit } from './TraceStoreSplit'
import { TraceErrors } from './TraceErrors'

interface TracePanelProps {
  trace: AgentTrace
}

export function TracePanel({ trace }: TracePanelProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Agent Trace</h3>
      </div>
      <div className="p-4 space-y-3">
        <TraceHeader trace={trace} />
        <TraceScrapeStep step={trace.steps.scrape} />
        <TraceMatchingStep step={trace.steps.matching} />
        <TraceComparisonStep step={trace.steps.comparison} />
        <TraceStoreSplit step={trace.steps.store_split} />
        <TraceErrors errors={trace.errors} warnings={trace.warnings} />
      </div>
    </div>
  )
}
