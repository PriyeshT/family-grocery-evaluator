# Issue Dependency Tree

Last updated: 2026-06-08

Reference for issue sequencing across the backlog. Use this to decide which issues can be worked in parallel sessions and which must wait on a predecessor.

---

## Agentic AI System — Epic #47

```
START
  │
  └─── #48  Retire legacy Cold Storage code          (no deps — clean the base first)
             │
             └─── #49  Define Claude tool schemas    (foundation for everything below)
                        │
                        ├─── #50  LLM semantic matching (replace fuzzyScore)   ┐
                        └─── #51  LLM-driven scrape section selection           ┘  ← parallel
                                   │
                              (both feed into)
                                   │
                                   ▼
                             #52  Agentic loop orchestrator (replace runGroceryAgent)
                                   │
                        ┌──────────┴──────────┐
                        ▼                     ▼
              #53  LLM recommendation      #54  Extend trace for LLM steps    ← parallel
                   summary                       │
                                                 ▼
                                           #55  Trace UI for agent reasoning
```

### Post-agentic system (needs #52–#55 stable)

```
#52–#55 complete
        │
        ├─── #9   TraceStore database persistence   ┐
        ├─── #10  Scheduled / cron refresh          ┤  ← parallel
        └─── #15  Write README                      ┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
       #11         #13       #14
  WhatsApp/     User       AgentEval
  email push   accounts      Lab
  (needs #10    (needs #9)  (needs full
   + #53)                    system)
```

---

## Shopping List — Epic #43

```
START
  │
  └─── #45  Shopping list UI rehaul (compact layout)    (no deps)
             │
             └─── #46  Bulk add items                   (builds on new layout)
```

*(#44 separate /shopping-list route is tracked in epic #43 but not yet filed as a standalone issue)*

---

## Standalone issues

| Issue | Deps | Notes |
|-------|------|-------|
| #16 Deploy to Vercel | None | Fully independent |
| #15 Write README | #52–#55 | Most useful once agentic system is complete |

---

## Closed / superseded

| Issue | Reason |
|-------|--------|
| #5  Cold Storage scraper | Removed by #48 — FairPrice-only focus |
| #7  localStorage persistence | Superseded by #9 (database persistence) |
| #8  Store location awareness | Moot — FairPrice-only, no store split needed |
| #12 LLM reasoning layer | Superseded by Agentic AI epic #47 |

---

## Session planning guide

| Wave | Issues | Parallel? |
|------|--------|-----------|
| 0 | #48, #16, #45 | Yes — 3 independent sessions |
| 1 | #49 (after #48), #46 (after #45) | Yes — 2 independent sessions |
| 2 | #50, #51 | Yes — both need only #49 |
| 3 | #52 | No — needs #49 + #50 + #51 |
| 4 | #53, #54 | Yes — both need only #52 |
| 5 | #55 | No — needs #54's type changes |
| 6 | #9, #10, #15 | Yes — independent of each other |
| 7 | #11, #13, #14 | Yes — each has its own upstream dep |
