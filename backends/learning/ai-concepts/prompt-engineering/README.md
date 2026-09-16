# Prompt Engineering

## What is this?

The model is fixed; the prompt is the program. "Prompt engineering" is the
unglamorous craft of writing the instructions and examples that get a reliable
answer out of a probabilistic system. For a backend engineer it's mostly about
**consistency** — you need the same shape of output every time so the next line of
code can parse it.

This module covers the handful of techniques that do most of the work. None of
them require a different model or any training — just better input.

## The techniques that matter

**Zero-shot** — just ask. Works for easy, common tasks. ([01](01-zero-vs-few-shot.ts))

**Few-shot** — show 2-5 worked examples before the real input. The model
pattern-matches your examples, which pins down format and edge-case handling far
better than a paragraph of instructions. This is the highest-leverage trick in the
module. ([01](01-zero-vs-few-shot.ts))

**Chain-of-thought (CoT)** — ask the model to reason step by step before
answering. Trades tokens (and latency) for accuracy on anything involving logic,
math, or multi-step deduction. ([02](02-chain-of-thought.ts))

**Prompt templates** — stop concatenating template literals ad hoc. A template
separates the fixed instructions from the runtime data, and uses delimiters so user
input can't be confused with your instructions (a first taste of the injection
problem you'll meet in [guardrails/](../guardrails/)). ([03](03-prompt-templates.ts))

## When would you use this?

- **Few-shot** whenever output format matters and a plain instruction isn't
  reliable enough — classification, extraction, rewriting to a house style.
- **CoT** for anything the model gets wrong on the first try that *you* could solve
  with a pen and paper.
- **Templates** the moment a prompt has runtime variables — i.e. always, in a real
  service.

## What the files cover

| File | What it teaches |
|---|---|
| `01-zero-vs-few-shot.ts` | The same classification task zero-shot vs few-shot; watch consistency jump |
| `02-chain-of-thought.ts` | A word problem the model flubs when rushed and nails when asked to reason first |
| `03-prompt-templates.ts` | A reusable template that separates instructions from data with delimiters |
| `04-fine-tuning-notes.md` | **Notes only** — when fine-tuning is worth it (rarely, for most teams) and when prompting/RAG wins |

## How to run

```bash
npx tsx 01-zero-vs-few-shot.ts            # both providers
npx tsx 02-chain-of-thought.ts anthropic  # one provider
```
