/*
Scheduled Workflows — .github/workflows/scheduled.yml
=======================================================

(Scheduling is language-agnostic. See workflows/scheduled.yml for an example.)

--- CRON SYNTAX (UTC) ---

  ┌ minute ┌ hour ┌ day-of-month ┌ month ┌ day-of-week (0=Sun)
  * * * * *
  "0 9 * * 1"      Monday 09:00 UTC          "0 0/6 * * *"  every 6 hours (a.k.a. star-slash-6)
  "30 2 * * *"     daily 02:30 UTC           "0 0 1 * *"    1st of month, midnight
GitHub may delay scheduled runs up to ~15 min under load — not for time-critical
jobs. Schedules run only on the default branch, and are disabled after 60 days of
repo inactivity.

--- workflow_dispatch (manual "Run workflow" button) ---

  on:
    workflow_dispatch:
      inputs:
        environment: { type: choice, options: [staging, production], default: staging }
        dry_run:     { type: boolean, default: true }
Input types: string · boolean · choice · number · environment.
Access: ${{ inputs.environment }}.

--- INPUTS ARE EMPTY ON SCHEDULED RUNS ---

On a schedule, github.event_name is "schedule" and inputs are empty. Supply
defaults so one workflow handles both: ${{ inputs.node_version || '22' }}.

--- CONDITIONAL STEPS ---

  - if: failure()                         # any previous step failed
  - if: success() && github.event_name == 'schedule'
  - if: inputs.dry_run != 'true'
Context funcs: success() · failure() · cancelled() · always() (cleanup).

--- TRIGGER MANUALLY ---

  gh workflow run scheduled.yml -f dry_run=false -f node_version=24
  gh run watch ; gh run list --workflow scheduled.yml

--- IDEMPOTENCY ---

Scheduled jobs may be retried or run manually, so they must be safe to repeat.
GOOD: run tests + report · delete files older than 7 days · upsert a status row.
BAD: insert a row / send an email / increment a counter each run.

--- WHEN TO USE vs EXTERNAL CRON ---

GitHub schedule: repo-bound jobs (tests, docs, dependency checks), no sub-minute
precision needed. External scheduler (EventBridge, Render, fly.io): punctual,
production infra, retries with backoff, runs even with no repo activity.
*/
export {};
