/*
CI Pipeline — .github/workflows/ci.yml  (Node)
========================================

CONCEPTS: workflow anatomy · path filters · concurrency · matrix across Node
versions · fail-fast: false · npm caching · separate lint/test · artifacts ·
status checks.

--- WHY CI? ---

"Works on my machine" is not a guarantee. CI runs your code in a clean,
reproducible environment every time. A PR that breaks on Node 20 but not 22
fails CI before it merges. Goal: keep main always deployable.

--- WORKFLOW ANATOMY ---

  on:                       trigger
    push: { branches: [main], paths: ["src/**"] }
  jobs:                     run in parallel by default
    build:
      runs-on: ubuntu-latest
      steps:
        - uses: ...         a marketplace Action
        - run: ...          a shell command

--- PATH FILTERS ---

  on: { push: { paths: ["backends/**", ".github/workflows/ci.yml"] } }
Only trigger when matching files change (a README edit shouldn't run the suite).
Include the workflow file itself so config changes re-run CI.

--- CONCURRENCY ---

  concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
Per-branch group; a new push cancels the previous in-progress run on that branch.

--- MATRIX ---

  strategy:
    matrix: { node-version: ["20", "22", "24"] }
    fail-fast: false        # run all entries even if one fails — full picture
Three parallel jobs, one per Node version. Reference: ${{ matrix.node-version }}.

--- npm CACHING ---

setup-node has built-in caching — point it at the lockfile:
  - uses: actions/setup-node@v4
    with: { node-version: ${{ matrix.node-version }}, cache: npm }
It keys the cache on package-lock.json and restores ~/.npm automatically. Then
use `npm ci` for clean, lockfile-exact installs.

--- SEPARATE LINT FROM TEST ---

  jobs: { lint: {...}, test: {...} }   # parallel, independent failure signals
A formatting error surfaces in seconds without waiting for the full test matrix.

--- ARTIFACTS ---

  - uses: actions/upload-artifact@v4
    if: failure()
    with: { name: coverage-${{ matrix.node-version }}, path: coverage/, retention-days: 7 }
Upload output on failure for post-mortem. Download: gh run download <id> --name ...

--- STATUS CHECKS ---

Settings → Branches → require status checks → select the job names. PRs can't
merge until CI is green.

--- THE NODE BUILDING BLOCKS ---

actions/setup-node sets the runtime; `npm ci` installs; `npm test` runs the
suite; a node-version matrix tests multiple versions; `cache: npm` caches the
install. Everything else (triggers, concurrency, matrix, artifacts) is generic.

See workflows/ci.yml in this folder for a complete runnable example.
*/
export {};
