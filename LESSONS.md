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

## A leftover .js file silently shadows its .ts replacement

**Expected:** writing `foo.ts` and forgetting to delete `foo.js` would show up as
a duplicate, or at worst as nothing at all.

**What happened:** Jest resolves `moduleFileExtensions` in order and `js` comes
before `ts`. With both files present it loaded the stale CommonJS one and failed
with `SyntaxError: The requested module './binary_search_tree.js' does not
provide an export named 'BinarySearchTreeNode'`. The export was right there in
the `.ts` file, so the message sends you to inspect a file that has nothing wrong
with it. tsc said nothing, because the `.ts` file was fine.

**What to do differently:** delete the `.js` in the same step that writes the
`.ts`, never as a cleanup pass afterwards. When a converted module reports a
missing export that is plainly present, check for a twin before reading the
source again:

    for ts in $(find . -name '*.ts' -not -path '*/node_modules/*'); do
      [ -f "${ts%.ts}.js" ] && echo "LEFTOVER: ${ts%.ts}.js"
    done
