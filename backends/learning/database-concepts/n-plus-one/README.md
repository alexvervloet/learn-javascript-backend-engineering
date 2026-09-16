# The N+1 Query Problem

## What is this?

The N+1 problem is one of the most common performance bugs in backend development. It's sneaky — the code looks correct, tests pass, and it works fine during development with a handful of rows. Then it hits production with 10,000 rows and the page takes 30 seconds to load.

Here's the pattern that causes it:

```js
// Fetch all 100 orders — that's 1 query
const { rows: orders } = await pool.query("SELECT * FROM orders");

// For each order, fetch the customer — that's N more queries
for (const order of orders) {
  const { rows } = await pool.query(
    "SELECT * FROM customers WHERE id = $1",
    [order.customer_id]
  );
  console.log(rows[0].name); // a query each time!
}
```

For 100 orders, this runs **101 queries** instead of 1. For 1,000 orders, it's 1,001 queries. The number of queries grows linearly with the number of rows — hence "N+1."

## Why does this happen?

ORMs like Prisma are helpful: when you access `order.customer`, they can automatically run a query to fetch the related customer. This is called **lazy loading** — the relationship is loaded on demand. It's convenient but dangerous in loops. The same trap appears with raw SQL the moment you put a query inside a loop.

## The fix: eager loading

Instead of loading relationships lazily (one at a time, as you access them), you load them eagerly (all at once, in the initial query):

```js
// Fetch orders AND their customers in a single query (JOIN)
const { rows } = await pool.query(`
  SELECT orders.*, customers.name AS customer_name
  FROM orders
  JOIN customers ON customers.id = orders.customer_id
`);

// The customer name is already on each row — no extra queries
for (const row of rows) {
  console.log(row.customer_name); // no query!
}
```

## What the files cover

| File | What it teaches |
|---|---|
| `01_n_plus_one.ts` | Demonstrates the problem clearly — shows the query count growing with row count |
| `02_solutions.ts` | The fixes: a single JOIN, a batched `WHERE id IN (...)` query, and when to use each |
| `03_tradeoffs.ts` | Eager loading isn't always better — loading too much data has its own costs |

## How to run

```bash
# Requires PostgreSQL
docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres

npx tsx 01_n_plus_one.ts
npx tsx 02_solutions.ts
npx tsx 03_tradeoffs.ts
```
