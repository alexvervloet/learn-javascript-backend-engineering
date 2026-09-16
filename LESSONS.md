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

## `declare global` does not compose across two apps in one program

**Expected:** augmenting Express's `Request` with the fields our middleware
attaches is the documented pattern, so doing it in each app would be fine.

**What happened:** it is the documented pattern, and it is genuinely global. Both
capstone apps declare `req.user`, and their `User` is a different Prisma model
with different columns. One tsconfig covers both, so the two declarations merged
and every handler in the url-shortener started failing with complaints about
`email` and `passwordHash` — fields that belong to the *other* app's user. The
error pointed at url-shortener files while the cause sat in bookmark-manager.

**What to do differently:** in a repo with more than one app, do not augment
Express's `Request` globally. Declare an app-local `AppRequest extends Request`
with the extra fields and have that app's `asyncHandler` hand it to its
callbacks. Widening at that one boundary is sound, because `AppRequest` only
adds optional properties, and each app's request shape stays its own. Global
augmentation is fine for a single deployable, and only for that.

## The conversion found a real bug in the basic-auth demo

**Expected:** a type conversion changes types, not behaviour.

**What happened:** `advanced/server.ts` compared credentials with
`crypto.timingSafeEqual(Buffer.from(pass || ""), Buffer.from("password123"))`.
That function throws when the two buffers differ in byte length, so any password
that was not exactly 11 characters produced a 500 instead of a 401. The bug was
already there in JavaScript; what surfaced it was being forced to say what
`pass` was when `encoded` could be undefined, which made the whole expression
worth reading properly.

**What to do differently:** when the compiler makes you look at a line you had
been skimming, read the line rather than just satisfying it. The fix is a
`safeEqual` helper that compares lengths first and returns false, which is both
correct and still constant-time for equal-length inputs.

## Two AWS files must stay JavaScript, and one had a real API misuse

**Expected:** "convert everything" would mean every file.

**What happened:** `aws-concepts/lambda/functions/*/handler.js` are not repo
source. `01_deploy.ts` zips them and uploads them to Lambda, where they run under
the `nodejs20.x` runtime with a configured handler of `"handler.handler"` — which
means a file literally named `handler.js` inside the zip. Converting them would
need a bundling step before upload, which is a different lesson than the one the
module teaches. They stay CommonJS, with a comment at the top of each saying why.

Separately, `sqs/03_dead_letter.ts` asked for `ApproximateReceiveCount` through
`AttributeNames`, which the SDK types as `QueueAttributeName[]`.
`ApproximateReceiveCount` is a *message* system attribute; the field that carries
it is `MessageSystemAttributeNames`. The call had been working against the
legacy parameter and the types are what surfaced it.

**What to do differently:** before converting a directory, ask which files are
inputs to a runtime you do not control. Deployment artifacts, migration files a
CLI discovers by name, and anything zipped and shipped elsewhere have their own
constraints, and a blanket rename will break them quietly.
