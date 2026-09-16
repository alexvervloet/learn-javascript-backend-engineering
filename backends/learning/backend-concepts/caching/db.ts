/**
 * Database layer — better-sqlite3 engine, Product table, helpers.
 *
 * Product is the entity we cache throughout all five scripts: something
 * expensive to load but cheap to serve from cache (a product catalogue read
 * thousands of times per minute, updated rarely). SQLite in-memory keeps the
 * demos self-contained — only Redis needs to be running.
 */

import Database from "better-sqlite3";

// The row every script in this folder caches. better-sqlite3 cannot know what a
// SQL string returns, so the shape is declared once and handed to each
// prepare(). Note price is TEXT in the schema, so it is a string here — the
// type documents the decision the schema comment explains.
interface Product {
  id: number;
  name: string;
  price: string;
  stock: number;
}

const db = new Database(":memory:");

function resetSchema(): void {
  db.exec(`
    DROP TABLE IF EXISTS products;
    CREATE TABLE products (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL,
      price TEXT NOT NULL,   -- stored as text to preserve exact decimals
      stock INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function seed(): Product[] {
  const insert = db.prepare("INSERT INTO products (name, price, stock) VALUES (?, ?, ?)");
  const rows: [string, string, number][] = [
    ["Wireless Keyboard", "79.99", 42],
    ["USB-C Hub", "49.99", 130],
    ["Monitor Stand", "34.99", 17],
  ];
  return rows.map(([name, price, stock]) => {
    const info = insert.run(name, price, stock);
    const product = getProduct(Number(info.lastInsertRowid));
    if (product === null) {
      throw new Error("Seeded product could not be read back");
    }
    return product;
  });
}

function getProduct(id: number): Product | null {
  return (
    db.prepare<[number], Product>("SELECT * FROM products WHERE id = ?").get(id) ?? null
  );
}

function allProducts(): Product[] {
  return db.prepare<[], Product>("SELECT * FROM products ORDER BY id").all();
}

function printProducts(label = "DB state"): void {
  console.log(`\n  [${label}]`);
  for (const p of allProducts()) {
    console.log(`    Product(id=${p.id}, name=${JSON.stringify(p.name)}, price=${p.price}, stock=${p.stock})`);
  }
}

export { db, resetSchema, seed, getProduct, allProducts, printProducts };
export type { Product };
