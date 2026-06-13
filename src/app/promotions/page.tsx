'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PromotionsResult, PromotionsMatchResult, MatchedPromotion, FairPricePromotion, FairPriceSection, OpportunityItem } from '@/types'
import { SECTION_LABELS, SECTION_ORDER } from '@/types'
import { PromotionCard } from '@/components/promotions/PromotionCard'
import { OpportunitiesSection } from '@/components/promotions/OpportunitiesSection'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { loadShoppingList, addItemToList } from '@/lib/shopping-list-storage'
import Link from 'next/link'

type ViewMode = 'all' | 'list'
type ActiveTab = FairPriceSection | 'all-sections'

const SECTION_ICONS: Record<FairPriceSection, string> = {
  'flash-deals': '⚡',
  'price-slash': '🔖',
  'fresh-picks': '🥦',
  'weekly': '📅',
}

export default function PromotionsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [data, setData] = useState<PromotionsResult | null>(null)
  const [matchData, setMatchData] = useState<PromotionsMatchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('all-sections')
  const [searchQuery, setSearchQuery] = useState('')
  // Names of promotions already on the list (loaded once on mount)
  const [listTerms, setListTerms] = useState<Set<string>>(new Set())
  // Names added during this session
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set())
  // Opportunities state
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([])
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false)
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null)

  useEffect(() => {
    const items = loadShoppingList()
    setListTerms(new Set(items.map((i) => i.term.toLowerCase())))
  }, [])

  const handleAddToList = useCallback((promotionName: string) => {
    const added = addItemToList(promotionName)
    if (added) {
      setAddedNames((prev) => new Set(prev).add(promotionName))
      setListTerms((prev) => new Set(prev).add(promotionName.toLowerCase()))
    }
  }, [])

  const isOnList = useCallback((name: string) => listTerms.has(name.toLowerCase()), [listTerms])

  const fetchDeals = useCallback(async (mode: ViewMode) => {
    setLoading(true)
    setError(null)
    try {
      const url = mode === 'list' ? '/api/fairprice-promotions/matched' : '/api/fairprice-promotions'
      const res = await fetch(url)
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      if (mode === 'list') {
        setMatchData((await res.json()) as PromotionsMatchResult)
      } else {
        setData((await res.json()) as PromotionsResult)
      }
      setActiveTab('all-sections')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchOpportunities = useCallback(async () => {
    setOpportunitiesLoading(true)
    setOpportunitiesError(null)
    try {
      const currentList = loadShoppingList()
      const res = await fetch('/api/fairprice-promotions/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shoppingList: currentList }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const result = (await res.json()) as { opportunities: OpportunityItem[] }
      setOpportunities(result.opportunities)
    } catch (err) {
      setOpportunitiesError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setOpportunitiesLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDeals(viewMode)
  }, [fetchDeals, viewMode])

  useEffect(() => {
    if (viewMode === 'all') void fetchOpportunities()
  }, [viewMode, fetchOpportunities])

  const handleModeSwitch = (mode: ViewMode) => {
    setViewMode(mode)
    setActiveTab('all-sections')
    setSearchQuery('')
  }

  const allPromotions: FairPricePromotion[] =
    viewMode === 'all'
      ? (data?.promotions ?? [])
      : (matchData?.matched.map((m) => m.promotion) ?? [])

  const allMatched: MatchedPromotion[] = viewMode === 'list' ? (matchData?.matched ?? []) : []

  const query = searchQuery.toLowerCase()

  const getPromotionsForSection = (section: FairPriceSection): FairPricePromotion[] => {
    let items = allPromotions.filter((p) => p.category === section)
    if (section === 'price-slash') {
      items = [...items].sort((a, b) => (b.savingPct ?? 0) - (a.savingPct ?? 0))
    }
    if (query) items = items.filter((p) => p.name.toLowerCase().includes(query))
    return items
  }

  const getMatchedForSection = (section: FairPriceSection): MatchedPromotion[] => {
    let items = allMatched.filter((m) => m.promotion.category === section)
    if (section === 'price-slash') {
      items = [...items].sort((a, b) => (b.promotion.savingPct ?? 0) - (a.promotion.savingPct ?? 0))
    }
    if (query) items = items.filter((m) => m.promotion.name.toLowerCase().includes(query))
    return items
  }

  const getListMatchCount = (section: FairPriceSection): number =>
    allMatched.filter((m) => m.promotion.category === section).length

  const getSectionTotal = (section: FairPriceSection): number =>
    allPromotions.filter((p) => p.category === section).length

  const presentSections = SECTION_ORDER.filter((s) => getSectionTotal(s) > 0)

  const scrapedAt = viewMode === 'all' ? data?.scrapedAt : matchData?.scrapedAt
  const usedFallback = viewMode === 'all' ? data?.usedFallback : matchData?.usedFallback
  const lastUpdated = scrapedAt
    ? new Date(scrapedAt).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  const hasContent = !loading && !error

  const sectionsToRender = activeTab === 'all-sections' ? presentSections : presentSections.filter((s) => s === activeTab)

  const renderCard = (promotion: FairPricePromotion, i: number, matchedMeta?: { matchMethod: 'exact' | 'fuzzy' | 'llm'; confidence: number; shoppingListTerm: string }) => {
    // In "list" mode, matched items are already on the list by definition
    const onList = viewMode === 'list' ? true : isOnList(promotion.name)
    const justAdded = addedNames.has(promotion.name)
    return (
      <PromotionCard
        key={`${promotion.name}-${i}`}
        promotion={promotion}
        matchMethod={matchedMeta?.matchMethod}
        confidence={matchedMeta?.confidence}
        shoppingListTerm={matchedMeta?.shoppingListTerm}
        isOnList={onList && !justAdded}
        wasJustAdded={justAdded}
        onAddToList={onList || justAdded ? undefined : () => handleAddToList(promotion.name)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FairPrice Promotions</h1>
            {lastUpdated && (
              <p className="text-sm text-gray-500 mt-0.5">Last updated: {lastUpdated}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {usedFallback && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                Demo data — live scrape unavailable
              </span>
            )}
            <button
              onClick={() => void fetchDeals(viewMode)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* View mode toggle + search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => handleModeSwitch('all')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All promotions
            </button>
            <button
              onClick={() => handleModeSwitch('list')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              On my list
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search promotions…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1.5 text-lg leading-none text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Savings banner — list mode only, when matches exist */}
        {hasContent && viewMode === 'list' && matchData && matchData.matched.length > 0 && (() => {
          const matchedCount = matchData.matched.length
          const totalSavings = matchData.matched.reduce((sum, m) => sum + (m.promotion.savingAmount ?? 0), 0)
          return (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">{matchedCount} item{matchedCount !== 1 ? 's' : ''} on your list</span>
                {' '}are on promotion
                {totalSavings > 0 && (
                  <> — save up to <span className="font-semibold">${totalSavings.toFixed(2)}</span></>
                )}
              </p>
              <Link
                href="/?replan=1"
                className="flex-shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Update my plan →
              </Link>
            </div>
          )
        })()}

        {/* Section tabs */}
        {hasContent && presentSections.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
            <button
              onClick={() => setActiveTab('all-sections')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'all-sections'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              All sections
            </button>
            {presentSections.map((section) => {
              const total = getSectionTotal(section)
              const matchCount = viewMode === 'list' ? getListMatchCount(section) : null
              const isFlash = section === 'flash-deals'
              const isActive = activeTab === section
              return (
                <button
                  key={section}
                  onClick={() => setActiveTab(section)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? isFlash
                        ? 'bg-orange-500 text-white'
                        : 'bg-blue-600 text-white'
                      : isFlash
                        ? 'bg-orange-50 text-orange-700 border border-orange-200 hover:border-orange-400'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  <span>{SECTION_ICONS[section]}</span>
                  <span>{SECTION_LABELS[section]}</span>
                  <span className={`text-xs ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                    {matchCount !== null ? `${matchCount}/${total}` : `(${total})`}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Content states */}
        {loading && <LoadingSkeleton />}
        {!loading && error && (
          <ErrorState message={error} onRetry={() => void fetchDeals(viewMode)} />
        )}

        {hasContent && presentSections.length === 0 && (() => {
          // Live page is JS-rendered — section headings not found; fall back to flat grid
          const flatAll = allPromotions.filter((p) => !query || p.name.toLowerCase().includes(query))
          const flatMatched = allMatched.filter((m) => !query || m.promotion.name.toLowerCase().includes(query))
          const flatCount = viewMode === 'all' ? flatAll.length : flatMatched.length
          return flatCount === 0 ? (
            <EmptyState
              message={
                viewMode === 'list'
                  ? 'None of your shopping list items are currently on promotion.'
                  : 'No promotions match your search.'
              }
            />
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-4">{flatCount} promotion{flatCount !== 1 ? 's' : ''}{searchQuery ? ` matching "${searchQuery}"` : ''}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {viewMode === 'all'
                  ? flatAll.map((promotion, i) => renderCard(promotion, i))
                  : flatMatched.map((m, i) => renderCard(m.promotion, i, { matchMethod: m.matchMethod, confidence: m.confidence, shoppingListTerm: m.shoppingListTerm }))}
              </div>
            </div>
          )
        })()}

        {hasContent && presentSections.length > 0 && (
          <div className="space-y-10">
            {sectionsToRender.map((section) => {
              const items = viewMode === 'all' ? getPromotionsForSection(section) : []
              const matched = viewMode === 'list' ? getMatchedForSection(section) : []
              const displayCount = viewMode === 'all' ? items.length : matched.length
              const listCount = viewMode === 'list' ? getListMatchCount(section) : null
              const sectionTotal = getSectionTotal(section)
              const isFlash = section === 'flash-deals'

              if (displayCount === 0 && !query) return null
              if (displayCount === 0 && query) {
                return (
                  <SectionGroup
                    key={section}
                    section={section}
                    listCount={listCount}
                    sectionTotal={sectionTotal}
                    isFlash={isFlash}
                  >
                    <EmptyState message={`No results in ${SECTION_LABELS[section]} for "${searchQuery}"`} />
                  </SectionGroup>
                )
              }

              return (
                <SectionGroup
                  key={section}
                  section={section}
                  listCount={listCount}
                  sectionTotal={sectionTotal}
                  isFlash={isFlash}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {viewMode === 'all'
                      ? items.map((promotion, i) => renderCard(promotion, i))
                      : matched.map((m, i) => renderCard(m.promotion, i, { matchMethod: m.matchMethod, confidence: m.confidence, shoppingListTerm: m.shoppingListTerm }))}
                  </div>
                </SectionGroup>
              )
            })}

            {sectionsToRender.length > 0 &&
              sectionsToRender.every((s) => {
                const count = viewMode === 'all' ? getPromotionsForSection(s).length : getMatchedForSection(s).length
                return count === 0
              }) &&
              !query && (
                <EmptyState
                  message={
                    viewMode === 'list'
                      ? 'None of your shopping list items are currently on promotion.'
                      : 'No promotions available.'
                  }
                />
              )}
          </div>
        )}

        {/* Unmatched list items (list mode only) */}
        {hasContent && viewMode === 'list' && matchData && matchData.unmatched.length > 0 && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-600 mb-1">
              Not on promotion ({matchData.unmatched.length}):
            </p>
            <p className="text-sm text-gray-500">{matchData.unmatched.join(', ')}</p>
          </div>
        )}

        {/* AI-surfaced opportunities (all mode only) */}
        {viewMode === 'all' && !loading && (
          <OpportunitiesSection
            opportunities={opportunities}
            loading={opportunitiesLoading}
            error={opportunitiesError}
            addedNames={addedNames}
            listTerms={listTerms}
            onAddToList={handleAddToList}
            onRetry={() => void fetchOpportunities()}
          />
        )}
      </div>
    </div>
  )
}

interface SectionGroupProps {
  section: FairPriceSection
  listCount: number | null
  sectionTotal: number
  isFlash: boolean
  children: React.ReactNode
}

function SectionGroup({ section, listCount, sectionTotal, isFlash, children }: SectionGroupProps) {
  return (
    <section>
      <div className={`flex items-center gap-3 mb-4 pb-2 border-b-2 ${isFlash ? 'border-orange-400' : 'border-gray-200'}`}>
        <span className="text-xl">{SECTION_ICONS[section]}</span>
        <h2 className={`text-lg font-bold ${isFlash ? 'text-orange-700' : 'text-gray-800'}`}>
          {SECTION_LABELS[section]}
        </h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isFlash ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
          {sectionTotal}
        </span>
        {isFlash && (
          <span className="text-xs font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full animate-pulse">
            Ends soon
          </span>
        )}
        {listCount !== null && listCount > 0 && (
          <span className="ml-auto text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
            {listCount} of your list item{listCount !== 1 ? 's' : ''} here
          </span>
        )}
        {listCount === 0 && (
          <span className="ml-auto text-xs text-gray-400">None on your list</span>
        )}
      </div>
      {children}
    </section>
  )
}
