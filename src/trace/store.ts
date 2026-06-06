import type { AgentTrace } from './types'
import { config } from '@/lib/config'

// Phase 2 — replace with database persistence
export class TraceStore {
  private buffer: AgentTrace[] = []
  private maxSize: number

  constructor(maxSize: number = config.maxStoredTraces) {
    this.maxSize = maxSize
  }

  save(trace: AgentTrace): void {
    this.buffer.push(trace)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  getLatest(): AgentTrace | null {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : null
  }

  getAll(): AgentTrace[] {
    return [...this.buffer]
  }

  clear(): void {
    this.buffer = []
  }
}

export const traceStore = new TraceStore()
