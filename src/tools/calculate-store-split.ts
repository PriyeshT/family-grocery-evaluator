import type { ComparedItem, StoreSplitStep } from '@/trace/types'
import type { Config } from '@/lib/config'

export function calculateStoreSplit(
  compared: ComparedItem[],
  cfg: Config
): StoreSplitStep {
  const bothAvailable = compared.filter((c) => c.fairprice_deal && c.coldstorage_deal)
  const totalSavingsFromSplit = bothAvailable.reduce((sum, c) => sum + c.saving_amount, 0)

  if (bothAvailable.length === 0 || totalSavingsFromSplit < cfg.storeSplitSavingsThreshold) {
    // Determine which single store covers more items
    const fpCount = compared.filter((c) => c.winner === 'fairprice').length
    const csCount = compared.filter((c) => c.winner === 'coldstorage').length
    const primary = fpCount >= csCount ? 'fairprice' : 'coldstorage'

    const reason =
      bothAvailable.length === 0
        ? `All matched items are only available at one store. Shop at ${storeLabel(primary)} for everything.`
        : `Splitting your shop would save $${totalSavingsFromSplit.toFixed(2)}, which is below the $${cfg.storeSplitSavingsThreshold.toFixed(2)} threshold. Shop at ${storeLabel(primary)} for everything.`

    return {
      recommendation: 'single_store',
      primary_store: primary,
      split_store: null,
      estimated_total_savings: parseFloat(totalSavingsFromSplit.toFixed(2)),
      threshold_applied: cfg.storeSplitSavingsThreshold,
      reasoning: reason,
    }
  }

  // Split is worth it — assign each item to its winning store
  const fpItems = bothAvailable.filter((c) => c.winner === 'fairprice').map((c) => c.item_name)
  const csItems = bothAvailable.filter((c) => c.winner === 'coldstorage').map((c) => c.item_name)
  const primary = fpItems.length >= csItems.length ? 'fairprice' : 'coldstorage'
  const splitStore = primary === 'fairprice' ? 'coldstorage' : 'fairprice'

  const reason =
    `Splitting saves $${totalSavingsFromSplit.toFixed(2)} across ${bothAvailable.length} items. ` +
    `Get ${fpItems.join(', ')} from FairPrice and ${csItems.join(', ')} from Cold Storage.`

  return {
    recommendation: 'split',
    primary_store: primary,
    split_store: splitStore,
    estimated_total_savings: parseFloat(totalSavingsFromSplit.toFixed(2)),
    threshold_applied: cfg.storeSplitSavingsThreshold,
    reasoning: reason,
  }
}

function storeLabel(store: 'fairprice' | 'coldstorage'): string {
  return store === 'fairprice' ? 'FairPrice' : 'Cold Storage'
}
