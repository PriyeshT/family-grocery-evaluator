# Singapore Grocery Promotions Tracker — Project Plan

## 1. Architecture Decisions

### Why Next.js 14 App Router
- Collocates API routes with UI in one deployable unit — no separate backend service needed for MVP
- Server Components reduce client-side JS for deal cards (static-ish content)
- API routes (`/api/...`) run as Vercel serverless functions — zero infra overhead
- App Router file-based routing keeps the project navigable for external reviewers

### Why Cheerio (not Playwright)
- Cheerio is synchronous HTML parsing — fast, no browser binary, works in Vercel serverless
- **Risk**: both FairPrice and Cold Storage are likely React/Next.js SPAs — the promotions page HTML may be empty or partially server-rendered
- Mitigation: scraper investigation is the first task; if JS rendering is confirmed, we fall back to mock data for MVP and flag Playwright/XHR interception for Phase 2
- Mock data is built regardless so the full agent pipeline runs in CI and demo environments

### Why an in-memory TraceStore
- Zero dependencies for MVP — no DB provisioning, no Supabase setup, no migrations
- Last 10 runs is sufficient for demo and debugging
- Code is already annotated for Phase 2 database replacement

### Why a class-based TraceBuilder
- Enforces step ordering — you cannot record matching before scraping
- Immutability guard prevents accidental overwrites mid-run
- Single source of truth for a run's lifecycle — easy to test in isolation

### Why Vitest over Jest
- Native ESM support — no transform config needed with Next.js
- Faster watch mode
- Compatible with the existing Next.js 14 + TypeScript setup

---

## 2. Folder Structure

```
Family Grocery Evaluator/
├── .github/
│   └── PULL_REQUEST_TEMPLATE.md
├── src/
│   ├── agents/
│   │   └── grocery-agent.ts          ← orchestrator: runs all tools, drives trace
│   ├── tools/
│   │   ├── scrape-fairprice.ts        ← fetches + parses FairPrice promotions HTML
│   │   ├── scrape-coldstorage.ts      ← fetches + parses Cold Storage promotions HTML
│   │   ├── match-items.ts             ← exact + fuzzy matching against deals
│   │   ├── compare-prices.ts          ← per-item FairPrice vs Cold Storage comparison
│   │   └── calculate-store-split.ts   ← recommends single store or split shop
│   ├── trace/
│   │   ├── types.ts                   ← AgentTrace, ScrapeSummary, MatchedItem, etc.
│   │   ├── builder.ts                 ← TraceBuilder class (step recorder)
│   │   └── store.ts                   ← TraceStore (circular buffer, in-memory)
│   ├── types/
│   │   └── index.ts                   ← RawDeal, ShoppingPlan, StoreSplitRecommendation
│   ├── lib/
│   │   ├── config.ts                  ← typed config object (thresholds, limits)
│   │   ├── shopping-list.ts           ← hardcoded MVP list
│   │   └── mock-data.ts               ← realistic fake deals for both stores
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   ← dashboard root
│   │   └── api/
│   │       ├── promotions/
│   │       │   ├── route.ts           ← POST /api/promotions
│   │       │   └── latest/
│   │       │       └── route.ts       ← GET /api/promotions/latest
│   │       └── trace/
│   │           ├── route.ts           ← GET /api/trace
│   │           └── latest/
│   │               └── route.ts       ← GET /api/trace/latest
│   └── components/
│       ├── ui/
│       │   ├── LoadingSkeleton.tsx
│       │   ├── ErrorState.tsx
│       │   └── EmptyState.tsx
│       ├── dashboard/
│       │   ├── DealCard.tsx           ← single deal, sorted by savings %
│       │   ├── StoreSplitCard.tsx     ← recommendation + reasoning
│       │   └── RefreshButton.tsx
│       └── trace/
│           ├── TracePanel.tsx
│           ├── TraceHeader.tsx
│           ├── TraceScrapeStep.tsx
│           ├── TraceMatchingStep.tsx
│           ├── TraceComparisonStep.tsx
│           ├── TraceStoreSplit.tsx
│           └── TraceErrors.tsx
├── src/__tests__/
│   ├── tools/
│   │   ├── match-items.test.ts
│   │   ├── compare-prices.test.ts
│   │   └── calculate-store-split.test.ts
│   ├── trace/
│   │   ├── builder.test.ts
│   │   └── store.test.ts
│   └── agents/
│       └── grocery-agent.test.ts      ← integration test, all tools mocked
├── .env.example
├── .env.local                         ← gitignored
├── vercel.json
├── vitest.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
└── README.md
```

### Rationale for key separations
- `agents/` vs `tools/`: tools are pure functions (input → output, testable in isolation); the agent is the orchestrator that has side effects (trace recording, store saves)
- `trace/` is its own top-level module because it is a cross-cutting concern — not part of business logic, not UI, not a tool
- `components/trace/` is separate from `components/dashboard/` so the observability layer can be toggled or extracted without touching deal display code

---

## 3. Data Flow

```
User clicks "Refresh"
        │
        ▼
POST /api/promotions
        │
        ▼
runGroceryAgent()
  │
  ├─ TraceBuilder.startRun()
  │
  ├─ scrape_fairprice(FAIRPRICE_URL)  ─────┐
  ├─ scrape_coldstorage(COLDSTORAGE_URL) ──┘  (parallel)
  │       └─ on failure: use mock-data.ts
  │
  ├─ TraceBuilder.recordScrape(fairprice, coldstorage)
  │
  ├─ match_items_to_deals(SHOPPING_LIST, allDeals)
  │       └─ exact match → fuzzy match → unmatched
  │
  ├─ TraceBuilder.recordMatching(result)
  │
  ├─ compare_prices(matchedDeals)
  │       └─ per item: FairPrice price vs Cold Storage price → winner + saving
  │
  ├─ TraceBuilder.recordComparison(result)
  │
  ├─ calculate_store_split(comparedDeals, config)
  │       └─ if split saves > threshold → recommend split; else single store
  │
  ├─ TraceBuilder.recordStoreSplit(result)
  │
  ├─ TraceBuilder.finalise() → AgentTrace (sealed, duration computed)
  │
  ├─ TraceStore.save(trace)
  │
  └─ return { plan: ShoppingPlan, run_id: string }
        │
        ▼
API responds with { plan, run_id }
        │
        ▼
Dashboard renders:
  - DealCards (sorted by savings%)
  - StoreSplitCard (reasoning text)
  - [Trace tab] → GET /api/trace/latest → TracePanel renders all steps
```

---

## 4. MVP vs Deferred

### In MVP (Phase 1)
| Feature | Notes |
|---|---|
| Scrape FairPrice promotions page | Cheerio; mock fallback if JS-rendered |
| Scrape Cold Storage promotions page | Same |
| Exact + fuzzy item matching | fuzzy = simple string includes / token overlap |
| Per-item price comparison | Winner, saving $, saving % |
| Store split recommendation | Threshold-based, plain English reasoning |
| Agent Trace — full structured object | All steps, errors, warnings |
| TraceBuilder + TraceStore | In-memory, last 10 runs |
| Dashboard UI | Deal cards, split card, refresh, loading/error/empty states |
| Agent Trace Panel | All 5 step components, collapsible, env-gated |
| 4 API routes | POST promotions, GET latest plan, GET latest trace, GET all traces |
| Unit tests — tools + trace | >80% coverage target |
| Integration test — agent orchestrator | Full run with mocked tools |
| README | Architecture, "why agentic", trace docs, env vars, phase roadmap |
| .env.example + vercel.json | Deploy-ready from day one |

### Explicitly deferred
| Feature | Phase |
|---|---|
| Editable shopping list UI | 2 |
| localStorage persistence | 2 |
| Store location awareness | 2 |
| Scheduled / cron refresh | 3 |
| WhatsApp / email push summary | 3 |
| Database persistence for TraceStore | 2 |
| LLM reasoning layer | 4 |
| User accounts | 4 |
| Price history | 4 |
| AgentEval Lab | 5 |
| Playwright scraping | 2 (if JS rendering confirmed) |

---

## 5. Known Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| FairPrice promotions page is JS-rendered (SPA) | High | High | Scraper investigation is Step 1; mock-data.ts is built unconditionally so the pipeline runs regardless |
| Cold Storage promotions page is JS-rendered | High | High | Same |
| DOM structure changes break scrapers | High | Medium | Scrapers fail gracefully and log to trace errors; mock fallback activates |
| Vercel serverless timeout (10s default) | Medium | Medium | Set `requestTimeoutMs` in config; scrapers run in parallel |
| Rate limiting / IP blocking from retail sites | Medium | Low for MVP | Only triggered manually; add `User-Agent` header; note in README |
| Fuzzy matching produces false positives | Medium | Medium | Confidence threshold in config; low-confidence matches appear as warnings in trace |
| No real deal data if both scrapers fail | Low (with mocks) | Low | Mock data always available; UI shows "using demo data" banner |

---

## 6. Agent Trace System — End-to-End

### Why this makes the system "agentic"
A traditional scraper fetches → transforms → displays. This system separates:
- **Goal** (find the best split-shop plan for a shopping list)
- **Tools** (scrape, match, compare, split — each independently callable and testable)
- **Orchestration** (agent decides which tools to call, in what order, handles failures)
- **Observability** (every decision is recorded in a structured trace)

The trace is what elevates this from "scraper" to "agent" — it captures not just the output but the reasoning behind every step.

### Lifecycle
1. `TraceBuilder.startRun()` — mints a `run_id` (uuid), records `triggered_at`, notes `trigger_type`
2. Each tool call feeds its output back to the builder via `recordScrape()`, `recordMatching()`, etc.
3. `finalise()` computes `duration_ms`, seals the trace (no further writes allowed), returns the `AgentTrace`
4. `TraceStore.save(trace)` pushes to circular buffer (evicts oldest if >10)
5. `GET /api/trace/latest` serves the most recent run to the UI
6. `TracePanel` renders each step as a collapsible card — status icon, item count, duration in the header

### Immutability contract
- TraceBuilder tracks which steps have been recorded via a `Set<StepName>`
- Calling `recordScrape()` twice throws — prevents accidental double-recording
- `finalise()` freezes the object (`Object.freeze`) before returning

### Demo mode
`NEXT_PUBLIC_SHOW_TRACE=true` (set in Vercel preview env and `.env.local`) renders the Trace tab.
In production (`NEXT_PUBLIC_SHOW_TRACE=false`) the tab is not rendered at all — no data leak.

---

## 7. Decisions (locked)

| # | Question | Decision |
|---|---|---|
| 1 | Scraper fallback UX | Show a visible "using demo data" banner when mock data is active |
| 2 | Fuzzy matching algorithm | Dependency-free token overlap for MVP; swap in `fuse.js` in a later phase if results are poor |
| 3 | Parallel scraping | `Promise.all` — both scrapers run concurrently |
| 4 | Branch strategy | All work on one branch: `feature/core-pipeline`; merged to `develop` via a single PR at the end |

---

## 8. Implementation Order

1. **Repo bootstrap** — `git init`, `npx create-next-app`, TypeScript strict, Tailwind, Vitest, ESLint, Prettier, `develop` branch, PR template, push `feature/core-pipeline`
2. **Scraper investigation** — fetch both URLs, inspect HTML, document findings, build `mock-data.ts`
3. **Types** (`/types`, `/trace/types.ts`) — all interfaces defined before any implementation
4. **Tools** (with tests alongside) — scrape → match → compare → split
5. **TraceBuilder + TraceStore** (with tests)
6. **Agent orchestrator** (with integration test)
7. **API routes**
8. **Dashboard UI** — deal cards, split card, loading/error/empty states
9. **Trace Panel UI** — all 5 step components
10. **README + vercel.json + .env.example**
11. **`npm run build` passes → PR `feature/core-pipeline` → `develop` → merge**
