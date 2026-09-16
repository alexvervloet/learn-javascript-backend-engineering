# Lambda

Lambda is serverless compute. You write a function, deploy it, and AWS runs it in
response to events — no servers to manage, paying only for run time.

## Key concepts

- **Function** — code with a handler (entry point), runtime, and memory/timeout config.
- **Handler** — the entry point as `file.export`. For `handler.js` exporting
  `handler`, it's `handler.handler`.
- **Event** — the input; its shape depends on the trigger (API Gateway, S3, SQS…).
- **Context** — invocation metadata (function name, remaining time, request ID).
- **Invocation types:**
  - `RequestResponse` — synchronous; caller waits for the result.
  - `Event` — asynchronous; Lambda queues the event and returns immediately.
- **Trigger / event source mapping** — wires an AWS service to invoke the function.

## Lambda in LocalStack

LocalStack runs functions in Docker containers, so it needs the Docker socket
mount in `docker-compose.yml` (already included). The first invoke of a new
function is slow while Docker pulls the `nodejs20.x` runtime image.

## Packaging

Lambda wants a zip. [zip.js](zip.js) builds one in memory with `adm-zip`
(`zipFile` for a file on disk, `zipCode` for an inline string). The handlers live
in `functions/<name>/handler.js`.

## What the files cover

| File | What it teaches |
|------|----------------|
| `01_deploy.ts` | Zip code, create a function, list, get config, re-deploy, delete |
| `02_invoke.ts` | Invoke sync and async, decode the Payload, handle function errors |
| `03_s3_trigger.ts` | Wire an S3 bucket to trigger a Lambda on `.csv` upload |

## How to run

```bash
npx tsx lambda/01_deploy.ts
npx tsx lambda/02_invoke.ts
npx tsx lambda/03_s3_trigger.ts
```
