import fs from 'fs/promises'
import path from 'path'
import type { FairPricePromotion, DealSnapshot, DealHistoryStats } from '@/types'

const DATA_FILE = path.join(process.cwd(), '.data', 'deal-history.json')
const MAX_WEEKS = 12

type StoredHistory = Record<string, DealSnapshot[]>

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

function getWeekKey(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

async function load(): Promise<StoredHistory> {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(content) as StoredHistory
  } catch {
    return {}
  }
}

async function persist(history: StoredHistory): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(history, null, 2))
}

export async function addSnapshots(
  promotions: FairPricePromotion[],
  store: 'fairprice',
  scrapedAt: string,
): Promise<void> {
  const history = await load()
  const weekKey = getWeekKey(new Date(scrapedAt))

  for (const p of promotions) {
    const key = normalize(p.name)
    const existing = history[key] ?? []

    if (!existing.some((s) => s.weekKey === weekKey)) {
      existing.push({ itemName: p.name, store, salePrice: p.salePrice, weekKey, scrapedAt })
    }

    history[key] = existing
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
      .slice(0, MAX_WEEKS)
  }

  await persist(history)
}

export async function getStatsForAll(
  itemNames: string[],
): Promise<Record<string, DealHistoryStats>> {
  const history = await load()
  const result: Record<string, DealHistoryStats> = {}

  for (const name of itemNames) {
    const key = normalize(name)
    const snapshots = history[key]
    if (!snapshots || snapshots.length < 2) continue

    const sortedByWeek = [...snapshots].sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    const currentPrice = sortedByWeek[0].salePrice
    const lowestPrice = Math.min(...snapshots.map((s) => s.salePrice))

    result[key] = {
      weeksOnPromotion: snapshots.length,
      isLowestPrice: currentPrice <= lowestPrice,
      lowestPriceWindowWeeks: snapshots.length,
    }
  }

  return result
}
