/**
 * GraphQL Playground Server
 * ==========================
 *
 * Mounts each section's schema at its own URL so you can explore them
 * interactively. Uses Express + `graphql-http` (the spec-compliant, framework-
 * agnostic handler) and serves the GraphiQL IDE from a CDN.
 *
 * Run:
 *   npm install                 (from the repo root)
 *   npx tsx backends/learning/graphql-concepts/app.ts
 *
 * Then open:
 *   http://localhost:8000/            ← index listing all sections
 *   http://localhost:8000/01/graphql  ← section 01 GraphiQL IDE (GET) / endpoint (POST)
 */

import { fileURLToPath } from "node:url";

import express from "express";
import { createHandler } from "graphql-http/lib/use/express";
import type { GraphQLSchema } from "graphql";

const app = express();

const SECTIONS = [
  ["01", "01-schema-basics", "Schema Basics — types, queries, mutations"],
  ["02", "02-relationships", "Relationships & N+1 — resolver methods, N+1 problem"],
  ["03", "03-dataloaders", "DataLoaders — batching to solve N+1"],
  ["04", "04-types", "Types — enums, unions, interfaces, custom scalars"],
  ["05", "05-mutations", "Mutations — CRUD and typed error handling"],
  ["06", "06-pagination", "Pagination — offset and cursor (Relay) patterns"],
];

// GraphiQL IDE served from CDN — points at the section's own /graphql endpoint.
const graphiql = (endpoint: string): string => `<!DOCTYPE html>
<html><head><title>GraphiQL ${endpoint}</title>
<link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" /></head>
<body style="margin:0"><div id="graphiql" style="height:100vh"></div>
<script crossorigin src="https://unpkg.com/react/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
<script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
<script>
  const fetcher = GraphiQL.createFetcher({ url: "${endpoint}" });
  ReactDOM.render(React.createElement(GraphiQL, { fetcher }), document.getElementById("graphiql"));
</script></body></html>`;

// Each section's schema is loaded by a path built at runtime. ESM has no
// require(), so this is `await import()` — which is async, hence the top-level
// await. A static import would not do: the paths come from the SECTIONS table.
interface SectionModule {
  schema: GraphQLSchema;
  // graphql-http wants the context factory to return an object it can pass
  // to resolvers, so the return type is stated rather than left unknown.
  makeContext?: () => Record<string, unknown>;
}

for (const [prefix, dir] of SECTIONS) {
  const mod = (await import(`./${dir}/schema.js`)) as SectionModule;
  const makeContext = dir === "03-dataloaders" ? mod.makeContext : undefined;
  const endpoint = `/${prefix}/graphql`;

  // GET → GraphiQL IDE; POST → execute the query.
  app.get(endpoint, (_req, res) => res.type("html").send(graphiql(endpoint)));
  app.post(
    endpoint,
    createHandler({ schema: mod.schema, context: makeContext && (() => makeContext()) })
  );
}

app.get("/", (_req, res) => {
  res.json({
    sections: SECTIONS.map(([prefix, , title]) => ({
      title,
      playground: `http://localhost:8000/${prefix}/graphql`,
    })),
  });
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("GraphQL playground on http://localhost:8000"));
}

export { app };
