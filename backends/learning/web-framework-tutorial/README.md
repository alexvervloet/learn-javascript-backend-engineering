# Web Framework Tutorial

A guided tour of building HTTP APIs on the 2026 Node stack: **Express**, with
**Zod** for request validation, **multer** for uploads, **cookie-parser** for
cookies, **better-sqlite3** for the database, and **ws** for WebSockets. Each
section adds one concept on top of the last.

## Structure

```
tutorial/server.ts   — core concepts (path/query params, bodies, validation,
                       files, cookies, headers, errors, SQLite CRUD)
advanced/server.ts   — advanced guide (streaming, SSE, custom responses,
                       basic auth, sub-apps, WebSockets, settings, pagination)
```

## Running

```bash
npm install                  # from the repo root
npx tsx tutorial/server.ts      # http://localhost:8000
npx tsx advanced/server.ts      # http://localhost:8001
```

```bash
curl 'localhost:8000/items/42?q=hi'
curl -X POST localhost:8000/items -H 'Content-Type: application/json' -d '{"name":"Foo","price":35.4,"tax":3.2}'
curl -N localhost:8001/stream/sse
curl -u admin:password123 localhost:8001/advanced/basic-auth
```

