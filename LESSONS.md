# Lessons

Things that did not go according to plan, written down as they happened.

## noUncheckedIndexedAccess does not suit an algorithms repo

**Expected:** turning on every strictness flag TypeScript offers would make the
conversion better across the board.

**What happened:** `noUncheckedIndexedAccess` types `nums[i]` as
`number | undefined`. That is a real improvement in the hash map, where a probe
can land on an empty slot, and in the adjacency-list graph, where `Map.get` can
miss. It is pure noise in the sorting algorithms, where the loop bounds already
guarantee the index is in range. A 17-line bubble sort produced four errors, none
of them bugs. The only ways out were `!` on every array read or capturing each
element into a checked local, and both wreck code whose entire job is to be read
and understood.

**What to do differently:** treat `noUncheckedIndexedAccess` as a per-project
call rather than part of "strict". It pays off where indexes come from outside
the code (parsing, probing, lookups) and costs where they come from a `for` loop
the reader can see. This repo runs `strict: true` without it.

## ts-jest does not support TypeScript 7

**Expected:** ts-jest is the default answer for TypeScript in Jest.

**What happened:** installing `typescript@latest` brought in 7.0.2, the native
port. ts-jest declares a peer range of `>=4.3 <7` and npm warned on install. It
reads the TypeScript compiler API, which the native port does not expose the same
way.

**What to do differently:** for transforming test files, prefer a transformer
that parses TypeScript itself instead of delegating to tsc. `@swc/jest` does not
care which TypeScript version is installed, so the typecheck and the test run can
never disagree about tooling. Typechecking stays with tsc, where it belongs.
