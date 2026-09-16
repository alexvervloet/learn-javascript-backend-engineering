# GitHub Actions

GitHub's built-in CI/CD. Workflows are YAML files in `.github/workflows/`; GitHub
runs them on the triggers you define — pushes, PRs, tags, schedules, or manual
dispatch. This module is the Node version of the patterns every backend engineer needs.

| Concept | Example workflow | Notes |
|---|---|---|
| CI — lint + test matrix | `workflows/ci.yml` | `01_ci_pipeline.ts` |
| Releases from version tags | `workflows/release.yml` | `02_release.ts` |
| Scheduled + manual dispatch | `workflows/scheduled.yml` | `03_scheduled.ts` |
| Environments + deploy gates | (illustrative) | `04_environments.ts` |
| Reusable workflows | (illustrative) | `05_reusable_workflows.ts` |

The example YAMLs live under `workflows/` here; copy them to `.github/workflows/`
at the repo root to make them run. The notes are concept walk-throughs.

## Anatomy

```yaml
name: CI
on: { push: { branches: [main] } }
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: npm }
      - run: npm ci
      - run: npm test
```

## gh CLI

```bash
gh workflow run scheduled.yml -f dry_run=false   # manual trigger
gh run watch                                     # follow a run
gh run list --workflow ci.yml                    # history
git tag v1.0.0 && git push origin v1.0.0         # fire release.yml
```
