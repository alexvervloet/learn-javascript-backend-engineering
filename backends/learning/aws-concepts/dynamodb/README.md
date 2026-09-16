# DynamoDB

DynamoDB is a fully managed NoSQL database. It stores items (like rows) in tables
addressed by a primary key. Unlike a relational DB there's no fixed schema — each
item can have different attributes.

## Key concepts

- **Table** — a collection of items; you fix only the primary key schema upfront.
- **Partition key (PK)** — required; hashed to pick the item's partition.
- **Sort key (SK)** — optional; combined with the PK for range queries in a partition.
- **Item** — a set of attributes (like a row); only key attributes are required.
- **GSI** — a secondary index with a *different* PK/SK to query by non-key attributes.
- **Query** — fetch by partition key (optionally filter by sort key). Fast.
- **Scan** — read every item, then optionally filter. Expensive — avoid at scale.

## Access patterns drive the design

You design the table *around the queries you need*. Need orders by user AND by
date? Model that into the keys or a GSI upfront.

## Raw vs Document client

- `02_crud.ts` uses the **raw** `DynamoDBClient` with attribute-value maps
  (`{ S: "x" }`, `{ N: "1" }`) — the wire format.
- `03_queries.ts` uses the **Document client** (`@aws-sdk/lib-dynamodb`), which
  marshals plain JS objects to and from attribute-value maps automatically.

## What the files cover

| File | What it teaches |
|------|----------------|
| `01_tables.ts` | Create a composite-key table, add a GSI, describe the table |
| `02_crud.ts` | PutItem, GetItem, UpdateItem (expressions), conditional update, DeleteItem |
| `03_queries.ts` | Query by PK, PK+SK range, FilterExpression, Scan, projection |

## How to run

```bash
npx tsx dynamodb/01_tables.ts
npx tsx dynamodb/02_crud.ts
npx tsx dynamodb/03_queries.ts
```
