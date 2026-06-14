'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
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
          <div className="max-w-md mx-auto py-12">
            <h2 className="text-base font-semibold text-brand-text-primary mb-6 text-center">
              Get started in 3 steps
            </h2>
            <ol className="space-y-5">
              {[
                {
                  label: <><Link href="/shopping-list" className="text-brand-primary hover:underline font-semibold">Shopping List</Link> — Add your grocery items and preferred brands</>,
                },
                {
                  label: <><span className="font-semibold text-brand-text-primary">Refresh Deals</span> — The AI agent finds the best current promotions for your list</>,
                },
                {
                  label: <><span className="font-semibold text-brand-text-primary">Browse Promotions</span> — See what&apos;s on sale this week, add items you&apos;ve missed</>,
                },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-brand-text-secondary leading-relaxed">{step.label}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {error && <ErrorState message={error} onRetry={refresh} />}

        {result && !loading && (
          <>
            {result.plan.summary && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">✨</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                    AI Recommendation
                  </span>
                </div>
                <p className="text-sm text-violet-700 leading-relaxed">{result.plan.summary}</p>
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
