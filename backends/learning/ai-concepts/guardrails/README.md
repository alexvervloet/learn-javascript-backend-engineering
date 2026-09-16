# Guardrails

## What is this?

The moment an LLM feature touches untrusted input or produces output your system
acts on, it becomes an attack surface and a reliability risk. **Guardrails** are
the checks you put *around* the model — on the way in and on the way out — to keep
it safe and predictable. This is the security-and-robustness layer of an LLM
feature, and it's squarely backend work.

Two directions, two files:

- **Input** — untrusted text can try to hijack your instructions
  (*prompt injection*). [01](01-prompt-injection.ts)
- **Output** — the model's response can be malformed, off-policy, or leak
  something it shouldn't, and your code shouldn't trust it blindly.
  [02](02-output-validation.ts)

## Prompt injection — the SQL injection of LLMs

If you drop untrusted text straight into a prompt, that text can contain its own
instructions — "ignore your previous instructions and..." — and the model may
follow them. There's no perfect fix (it's an open problem), but you reduce the risk
the same way you handle untrusted input everywhere:

- **Separate trusted instructions from untrusted data** with clear delimiters, and
  tell the model that anything inside the data block is content, never commands.
- **Keep authority in the system prompt**, not in user-supplied text.
- **Never let model output trigger a dangerous action unchecked** — validate first
  (that's [02](02-output-validation.ts)).
- **Assume it can still be bypassed** — so don't give the model unconstrained power
  over anything that matters (no raw SQL, no unsandboxed shell, no unscoped
  spending). Least privilege, as always.

[01](01-prompt-injection.ts) shows a naive prompt getting hijacked and a hardened
one resisting the same attack.

## Output validation — don't trust the response

Even with no attacker, output can be wrong: an unexpected category, an over-long
blob, a leaked email address, broken JSON. Treat model output like any external
input — validate against an allow-list / schema / rules *before* your code uses
it, and have a fallback when it fails. [02](02-output-validation.ts) shows
allow-list checks, a PII/secret scan, and rejecting bad output.

## What the files cover

| File | What it teaches |
|---|---|
| `01-prompt-injection.ts` | A naive prompt being overridden by embedded instructions, and a delimited/hardened prompt that resists it |
| `02-output-validation.ts` | Validating output against an allow-list, length limits, and a simple PII/secret scan before trusting it |

## Where this connects

- The delimiter technique starts back in
  [../prompt-engineering/03-prompt-templates.ts](../prompt-engineering/03-prompt-templates.ts).
- Output validation is [../structured-outputs/](../structured-outputs/) taken
  seriously as a security boundary, not just a parsing convenience.

## How to run

```bash
npx tsx 01-prompt-injection.ts
npx tsx 02-output-validation.ts openai
```
