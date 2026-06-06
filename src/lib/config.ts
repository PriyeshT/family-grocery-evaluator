export const config = {
  storeSplitSavingsThreshold: 2.0,
  fuzzyMatchThreshold: 0.4,
  maxStoredTraces: 10,
  requestTimeoutMs: 8000,
  promotionsCacheTtlMs: 60 * 60 * 1000,
} as const

export type Config = typeof config
