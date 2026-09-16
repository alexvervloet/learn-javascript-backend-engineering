# GraphQL Concepts (Node)

Hands-on GraphQL practice using **graphql-js** + **@graphql-tools/schema**
(schema-first) and **dataloader**. Each section is self-contained with a runnable
schema, concept notes, and Jest tests.

## Stack

| | |
|---|---|
| Schema | [graphql-js](https://graphql.org/graphql-js/) + [@graphql-tools/schema](https://the-guild.dev/graphql/tools) — schema-first SDL + resolvers |
| Batching | [`dataloader`](https://github.com/graphql/dataloader) |
| Playground | Express + [`graphql-http`](https://github.com/graphql/graphql-http) + GraphiQL (see `app.ts`) |
| Testing | `graphqlSync` / `graphql` — no HTTP needed |

## Schema-first vs code-first

These modules take the **schema-first** approach: write the SDL string, then a
parallel `resolvers` map, and combine them with `makeExecutableSchema`. (Pothos
is the popular code-first alternative — types first, schema derived — if you
prefer that.)

## Sections

| # | Folder | Key concepts |
|---|--------|-------------|
| 1 | `01-schema-basics/` | SDL, scalars, queries, mutations, input types |
| 2 | `02-relationships/` | field resolvers, "private" fields, the N+1 problem |
| 3 | `03-dataloaders/`   | `dataloader`, batching, per-request context |
| 4 | `04-types/`         | enums, custom scalars (Date), interfaces, unions, `__resolveType` |
| 5 | `05-mutations/`     | CRUD, partial updates, mutation-payload (typed-error union) |
| 6 | `06-pagination/`    | offset pagination, Relay cursor pagination, PageInfo |

Each section has `schema.ts` (runnable schema), `notes.ts` (concepts + queries),
and `schema.test.ts` (Jest tests). Sections 02/03/05/06 add a `data.ts` store;
03 adds `loaders.ts`.

## Run the tests

```bash
npm test                                  # whole repo
npm test -- backends/learning/graphql-concepts          # this module
npm test -- backends/learning/graphql-concepts/03       # one section
```

## Run the interactive playground

```bash
npx tsx backends/learning/graphql-concepts/app.ts
# open http://localhost:8000  (index)  or  http://localhost:8000/01/graphql
```

## GraphQL vs REST

```
REST:    GET /books/1 → server-decided { id, title, author, year, ... }
GraphQL: { book(id:"1") { title year } } → client-decided { title, year }
```

No over-fetching, no under-fetching, multiple resources in one request.

