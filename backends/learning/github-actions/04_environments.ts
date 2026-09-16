/*
Environments & Deployment Gates
=================================

(Entirely language-agnostic — only the test/deploy step commands differ.)

--- WHAT IS A GITHUB ENVIRONMENT? ---

A named deploy target ("staging", "production") with its own secrets/variables,
protection rules (require approval before a job runs), and deployment history on
the repo homepage. The "production" secret is only available to a job that sets
`environment: production` — and only after approval.

--- CREATE ENVIRONMENTS ---

Settings → Environments → New.
  staging:    no protection; secrets STAGING_DATABASE_URL, ...
  production: required reviewers (1-2), wait timer (e.g. 5m), allowed branches
              (main only), secrets PRODUCTION_DATABASE_URL, ...

--- EXAMPLE DEPLOY WORKFLOW ---

  on:
    workflow_dispatch:
      inputs: { target: { type: environment, required: true } }
  jobs:
    test:            { runs-on: ubuntu-latest, steps: [..., { run: npm test }] }
    deploy-staging:
      needs: test
      environment: staging            # unlocks staging secrets, logs deployment
      steps: [{ run: "deploy.sh staging", env: { DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }} } }]
    deploy-production:
      needs: deploy-staging
      environment: production         # pauses for approval if reviewers are set
      steps: [{ run: "deploy.sh production" }]

--- THE APPROVAL GATE ---

A job with `environment: production` (required reviewers) is queued + PAUSED;
reviewers get notified and click Approve; only then is a runner allocated.
Difference from a plain secrets approach: a human signs off before production.

--- SECRETS vs VARIABLES ---

  secrets (${{ secrets.NAME }}): encrypted, masked in logs — credentials/keys.
  vars    (${{ vars.NAME }}):    plaintext, visible — base URLs, region names.
Repository-level secrets reach all jobs; environment-level secrets only reach
jobs that set that `environment:`.

--- BUILD ONCE, PROMOTE ---

Build a single artifact; deploy the SAME digest to each env (never rebuild
between staging and production). Pass it via job `outputs:` + `needs:`.

--- JOB DEPENDENCIES ---

  needs: test           # run after test passes
  needs: [build, deploy-staging]
Without needs:, jobs run in parallel; with it they form a DAG.
*/
export {};
