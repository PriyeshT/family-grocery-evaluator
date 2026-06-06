@AGENTS.md

## Git rules for this project

- **`develop` is the integration branch** — all feature branches are cut from `develop`, all PRs target `develop` (`gh pr create --base develop`), never `main`
- **Branch before everything** — create and push the feature branch before touching any file, every time, no exceptions
- **Auto-merge command**: `gh pr merge --merge --delete-branch` — only after `npm run build` passes, always targeting `develop`
- **`main` is release-only** — never merge a feature branch directly to `main`; if `main` falls behind `develop`, merge `develop` → `main`, not the other way
