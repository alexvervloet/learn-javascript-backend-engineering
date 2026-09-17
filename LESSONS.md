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

## A dependency that resolves is not a dependency you declared

**Expected:** the ai-concepts scripts import `dotenv` and run, so `dotenv` was a
dependency of this repo.

**What happened:** it was never in `package.json`. Twenty files imported it and
every one of them worked, because `prisma` pulls in `@prisma/config`, which pulls
in `c12`, which pulls in `dotenv@16`, and npm hoisted it to the top-level
`node_modules`. A Prisma upgrade, a different package manager, or a dedupe would
have broken all twenty with `ERR_MODULE_NOT_FOUND`, and the error would point at
a file whose import statement is correct.

Declaring it properly then caused a second problem. `npm install dotenv` resolved
17.x rather than the 16.x that had been sitting there, and dotenv 17 prints a
banner on every `config()` call — including a tip advertising a third-party
service. Every demo in the module started with a line of someone else's
marketing. `quiet: true` turns it off.

**What to do differently:** trust the manifest, not the install. A phantom
dependency is invisible precisely because everything works on the machine where
you wrote it, so grep imports against `package.json` rather than waiting for a
failure. And when you promote a transitive package to a direct one, check which
major version you just adopted — you are not pinning what was already there, you
are picking something new.

## Converting the Jest config to TypeScript raised the repo's minimum Node

**Expected:** `jest.config.js` to `jest.config.ts` is a cosmetic change in a repo
that is TypeScript everywhere else. Jest documents TS config support.

**What happened:** it moved the floor from Node 20 to Node 22.18, and nothing said
so. Jest loads a `.ts` config by letting Node strip the types, which only became
the default in 22.18. Where that is unavailable Jest falls back to `ts-node`,
which this repo does not install, so the run dies before the first test with
"'ts-node' is required for the TypeScript configuration files". `npm run
typecheck` passes on Node 20 either way, so the two commands disagree about
whether the repo works.

Bisecting it took two installs: 22.17.1 fails, 22.18.0 passes.

**What to do differently:** a config file in a language the runtime does not
natively execute is a runtime requirement, not a style choice. When a config
changes extension, state the new floor in `engines` and a `.nvmrc` in the same
commit. Without one, the constraint is only discoverable by someone on an older
Node getting an error that names a package the project never mentioned.

## supertest builds a new HTTP server for every single request

**Expected:** `request(app)` sends a request. The suite was failing about one run
in eight, always the same way: a route that exists returning 404, in a different
test each time.

**What happened:** `request(app)` does far more than send a request. supertest's
`Test` constructor runs `http.createServer(app)` on every call, listens it on an
ephemeral port, and closes it once the response lands. `api()` is called once per
request, so the bookmark-manager suite alone was doing about 150 listen/close
cycles, with another 40 from the testing module, all inside one Jest worker
running serially.

Finding it took a while because the failure would not reproduce in isolation: 400
hammered requests in one file, clean; twelve runs of only the supertest suites,
clean. It needed the full 48-file suite, which is the only context where that
socket churn piles up.

Handing supertest a server that is already listening skips all of it —
`serverAddress` only creates a server when `app.address()` returns null, and
`end` only closes the one it created. One server per test file, listened in
`beforeAll` and closed in `afterAll`. Twenty-one consecutive clean runs since,
against a roughly one-in-eight failure rate before, and the bookmark-manager
suite got about 40% faster as a side effect.

Honest caveat: twenty-one clean runs is evidence, not proof. What it does do is
remove the mechanism.

**What to do differently:** when a test helper is called once per assertion, read
what it allocates. `request(app)` reads like a pure function and is not one. And
when a flake will not reproduce in a subset, that itself is the clue — it means
the cause is accumulated state in the shared process, not the code under test.

Separately, and found while chasing this: two `npm test` runs at once destroy
each other, because `globalSetup` recreates a test.db at a fixed path. The
resulting failures look exactly like a flaky suite. Noted at the top of
globalSetup.ts.

## A route that is shadowed does not fail, it answers wrongly

**Expected:** writing a README for the tutorial module meant describing code that
already worked. The plan was to add a reading order, not to change anything.

**What happened:** verifying the curl commands instead of trusting them turned up
a dead route. `/items/limited/` was declared after `/items/:item_id`, and Express
matches in declaration order and stops at the first hit, so every request to
`/items/limited/` was served by `:item_id` with `item_id` bound to the string
`"limited"`. The whole query-validation lesson — 3-to-50 characters, letters only
— had never executed once.

Nothing surfaced it. There is no warning at startup, no error at request time,
and the response is a perfectly good 200 with a plausible body:
`{"item_id":"limited","q":"ab"}`. It was only visible because the README claimed
that URL returns a 422 and it did not.

`/items/validated/:item_id` in the same file was fine, which is why this survived:
two path segments do not collide with a one-segment `:item_id`, so the neighbouring
route worked and made the broken one look like it must too.

**What to do differently:** declare specific paths before parameterised ones, as a
rule rather than case by case. And when writing documentation that claims a
command produces a particular result, run the command. Three of the sixteen
commands drafted for that README were wrong about their own endpoint, and one of
those three was wrong because the endpoint was.
