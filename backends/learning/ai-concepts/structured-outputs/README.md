# Structured Outputs

## What is this?

An LLM returns text. But your code needs *data* — an object with known fields, not
a paragraph. Structured outputs are the techniques for making the model emit valid,
parseable JSON that matches a schema you define, so the next line of code can
`JSON.parse()` it without praying.

This is the bridge between "the model said something" and "my program can act on
it." It's what turns an LLM into a component you can put in a pipeline.

## The progression

**1. Just ask for JSON** ([01](01-json-mode.ts)) — instruct the model to return
JSON and parse it. Works, but it's fragile: the model might wrap it in
```` ```json ```` fences, add a "Here you go:" preamble, or hallucinate a field.
You're parsing hope.

**2. Enforce a schema** ([02](02-zod-schema.ts)) — give the API a schema (via a Zod
schema) and let it *constrain generation* to match. The provider guarantees the
shape; you get back a validated object, not a string. This is the production
answer. Both Anthropic (`messages.parse` + `zodOutputFormat`) and OpenAI
(`chat.completions.parse` + `zodResponseFormat`) support it with the same Zod
schema. (Zod is a runtime schema validator for JavaScript — declare the shape once,
validate against it.)

**3. Handle the failures that remain** ([03](03-handling-failures.ts)) — even with
schema enforcement things go wrong: the model refuses, the output is truncated at
`max_tokens`, or a value is schema-valid but semantically wrong. Defensive parsing
and a retry loop.

## When would you use this?

Anywhere the LLM output feeds code rather than a human: extracting fields from an
email, classifying with metadata, generating an API request body, populating a
form. Basically every backend LLM feature.

## What the files cover

| File | What it teaches |
|---|---|
| `01-json-mode.ts` | Asking for JSON and parsing it — and the failure modes that make this fragile |
| `02-zod-schema.ts` | Defining a Zod schema once and getting a validated object from both providers |
| `03-handling-failures.ts` | Catching validation errors, refusals, and truncation; a simple retry-on-invalid loop |

## How to run

```bash
npx tsx 01-json-mode.ts
npx tsx 02-zod-schema.ts anthropic
```
