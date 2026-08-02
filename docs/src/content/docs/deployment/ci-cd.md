---
title: CI / CD
description: GitHub Actions workflows for house lights.
---

CI runs on every push to `dev` and `main`, and on every pull request to either branch.

## Workflows

| Workflow | File | What it checks |
|----------|------|----------------|
| Scrape | `scrape.yml` | Not CI — scheduled scraper job (runs scrapers on cron) |
| Semgrep | `semgrep.yml` | SAST for Python and TypeScript |
| Bandit | `bandit.yml` | Python-specific security issues |
| njsscan | `njsscan.yml` | Node.js / JavaScript security issues |
| Bearer | `bearer.yml` | Secrets detection and data privacy rules |
| OSV Scanner | `osv-scanner.yml` | Dependency vulnerability scanning |
| SonarCloud | `sonarcloud.yml` | Code quality and coverage |

## Branch protection

`main` is a protected branch:
- Direct pushes blocked — changes must come via PR from `dev`
- Required status checks: Semgrep, njsscan (must pass before merge)

## Dev → main workflow

```
feature work  →  commit to dev  →  push dev  →  CI runs
                                                   ↓
                                             open PR dev→main
                                                   ↓
                                         all checks pass
                                                   ↓
                                           merge to main
                                                   ↓
                                        Vercel deploys main
```

See [CONTRIBUTING.md](../../../../../CONTRIBUTING.md) in the repo root for the full workflow guide.

## Adding a new scanner

1. Create `.github/workflows/<name>.yml`
2. Add `branches: [main, dev]` to both `push` and `pull_request` triggers
3. If it's a required check, add it to branch protection rules in GitHub Settings → Branches
