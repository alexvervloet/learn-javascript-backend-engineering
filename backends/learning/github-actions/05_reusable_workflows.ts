/*
Reusable Workflows
==================

(The reuse mechanism is language-agnostic; the example below uses Node steps.)

--- THE PROBLEM ---

Three services (api, worker, cron) each have a workflow that checks out, sets up
Node, caches npm, installs, and runs tests. Copy-paste means a later change (add
coverage) gets applied to one and forgotten in the others. Define it once instead.

--- workflow_call (makes a workflow reusable) ---

  # .github/workflows/reusable-test.yml
  on:
    workflow_call:
      inputs:
        working_directory: { type: string, required: true }
        node_version:      { type: string, default: "22" }
      outputs:
        test_outcome: { value: ${{ jobs.test.outputs.outcome }} }
      secrets:
        CODECOV_TOKEN: { required: false }
  jobs:
    test:
      runs-on: ubuntu-latest
      outputs: { outcome: ${{ steps.run.outcome }} }
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: ${{ inputs.node_version }}, cache: npm }
        - run: npm ci
          working-directory: ${{ inputs.working_directory }}
        - id: run
          run: npm test
          working-directory: ${{ inputs.working_directory }}

--- CALLING IT ---

  jobs:
    test-a:
      uses: ./.github/workflows/reusable-test.yml         # local
      with: { working_directory: backends/bookmark-manager }
    test-b:
      uses: my-org/shared/.github/workflows/node-test.yml@main   # cross-repo
      with: { node_version: "20" }
Rules: `uses:` must be a full path (repo/path@ref or ./local); a job with `uses:`
cannot also have `steps:`.

--- SECRETS PASSING ---

  secrets: inherit                       # forward ALL caller secrets (convenient)
  secrets: { CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }} }   # explicit (least privilege)

--- OUTPUTS ---

Callee declares workflow-level outputs; caller reads them via needs:
  deploy: { needs: build, steps: [{ run: "deploy.sh ${{ needs.build.outputs.image_digest }}" }] }

--- LIMITATIONS ---

Can't call a reusable workflow from a composite action; max 4 levels deep;
environment secrets aren't inherited; a `uses:` job can't have services:/container:;
matrix lives in the CALLER, not the callee.

--- COMPOSITE ACTIONS vs REUSABLE WORKFLOWS ---

  Composite action (.github/actions/x/action.yml): STEP-level reuse, used inside a
    job's steps. Best for 3-5 repeated steps (checkout + setup-node + npm ci).
  Reusable workflow: JOB-level reuse, own runner + checkout. Best for full job
    patterns (setup + test + report) and supports environments/secrets:inherit/outputs.
*/
export {};
