'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ShoppingPlan } from '@/types'
import type { AgentTrace } from '@/trace/types'
import { loadShoppingList } from '@/lib/shopping-list-storage'
import { DealCard } from '@/components/dashboard/DealCard'
import { RefreshButton } from '@/components/dashboard/RefreshButton'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { TracePanel } from '@/components/trace/TracePanel'

const SHOW_TRACE = process.env.NEXT_PUBLIC_SHOW_TRACE === 'true'

interface RunResult {
  plan: ShoppingPlan
  trace: AgentTrace
  usingDemoData: boolean
}

export default function DashboardPage() {
  const [result, setResult] = useState<RunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'deals' | 'trace'>('deals')

  const refresh = useCallback(async () => {
    const list = loadShoppingList()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shoppingList: list }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { plan: ShoppingPlan; run_id: string; usingDemoData: boolean }
      const traceRes = await fetch('/api/trace/latest')
      const trace = (await traceRes.json()) as AgentTrace
      setResult({ plan: data.plan, trace, usingDemoData: data.usingDemoData })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (window.location.search.includes('replan=1')) {
      window.history.replaceState({}, '', '/')
      void refresh()
    }
  }, [refresh])

  const sortedItems =
    result?.plan.items.slice().sort((a, b) => (b.deal.savingPct ?? 0) - (a.deal.savingPct ?? 0)) ?? []

  return (
    <main className="min-h-screen bg-brand-bg">
      <header className="bg-brand-surface border-b border-brand-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-brand-primary">SG Grocery Deals</h1>
            <p className="text-xs text-brand-text-secondary">FairPrice</p>
          </div>
          <RefreshButton onClick={refresh} loading={loading} />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {result?.usingDemoData && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Demo data</strong> — one or more scrapers used mock data. Results are illustrative.
          </div>
        )}

        {!result && !loading && !error && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              Click <strong>Refresh deals</strong> to run the agent.
            </p>
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {error && <ErrorState message={error} onRetry={refresh} />}

        {result && !loading && (
          <>
            {result.plan.summary && (
              <div className="rounded-lg border border-brand-secondary/30 bg-brand-secondary/10 px-4 py-3 text-sm text-brand-primary">
                {result.plan.summary}
              </div>
            )}

            <div className="flex gap-1 border-b border-brand-border">
              <TabButton active={activeTab === 'deals'} onClick={() => setActiveTab('deals')}>
                Deals ({sortedItems.length})
              </TabButton>
              {SHOW_TRACE && (
                <TabButton active={activeTab === 'trace'} onClick={() => setActiveTab('trace')}>
                  Agent Trace
                </TabButton>
              )}
            </div>

            {activeTab === 'deals' && (
              <>
                {sortedItems.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedItems.map((item, i) => (
                      <DealCard key={`${item.shopping_list_term}-${i}`} item={item} />
                    ))}
                  </div>
                )}
                {result.plan.unmatched_items.length > 0 && (
                  <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
                    <p className="text-sm font-medium text-brand-text-secondary mb-2">No deals found for:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.plan.unmatched_items.map((item) => (
                        <span
                          key={item}
                          className="text-xs bg-brand-bg text-brand-text-secondary px-2 py-0.5 rounded"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-right text-sm text-brand-text-secondary">
                  Est. total:{' '}
                  <span className="font-mono font-medium text-brand-text-primary">
                    ${result.plan.estimated_total.toFixed(2)}
                  </span>{' '}
                  · Est. savings:{' '}
                  <span className="font-mono font-medium text-brand-secondary">
                    ${result.plan.estimated_savings.toFixed(2)}
                  </span>
                </div>
              </>
            )}

            {activeTab === 'trace' && SHOW_TRACE && <TracePanel trace={result.trace} />}
          </>
        )}
      </div>
    </main>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-brand-primary text-brand-primary'
          : 'border-transparent text-brand-text-secondary hover:text-brand-primary'
      }`}
    >
      {children}
    </button>
  )
}
