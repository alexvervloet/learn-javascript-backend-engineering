import { DynamoDBClient, CreateTableCommand, DeleteTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "../helpers.js";

// The Document client (lib-dynamodb) marshals plain JS objects to/from attribute
// values automatically, so you write `{ user_id: "u1" }` instead of
// `{ user_id: { S: "u1" } }`.
const base = new DynamoDBClient(config);
const doc = DynamoDBDocumentClient.from(base);
const TABLE = "events";

async function main() {
  // Setup: table with user_id (PK) + timestamp (SK).
  await base.send(
    new CreateTableCommand({
      TableName: TABLE,
      KeySchema: [
        { AttributeName: "user_id", KeyType: "HASH" },
        { AttributeName: "timestamp", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "user_id", AttributeType: "S" },
        { AttributeName: "timestamp", AttributeType: "S" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    })
  );

  // Seed data via a batch write (up to 25 items per call).
  const items = [
    { user_id: "u1", timestamp: "2024-01-01T10:00:00", event: "login", device: "mobile" },
    { user_id: "u1", timestamp: "2024-01-01T10:05:00", event: "purchase", amount: 49 },
    { user_id: "u1", timestamp: "2024-01-02T08:00:00", event: "login", device: "desktop" },
    { user_id: "u1", timestamp: "2024-01-03T09:00:00", event: "logout", device: "desktop" },
    { user_id: "u2", timestamp: "2024-01-01T11:00:00", event: "login", device: "mobile" },
    { user_id: "u2", timestamp: "2024-01-01T11:30:00", event: "purchase", amount: 120 },
  ];
  await doc.send(
    new BatchWriteCommand({ RequestItems: { [TABLE]: items.map((Item) => ({ PutRequest: { Item } })) } })
  );
  console.log(`Seeded ${items.length} items\n`);

  // --- Query by partition key only ---
  // Fetches all events for u1 — fast, touches only u1's partition.
  console.log("=== Query: all events for u1 ===");
  const all = await doc.send(
    new QueryCommand({ TableName: TABLE, KeyConditionExpression: "user_id = :u", ExpressionAttributeValues: { ":u": "u1" } })
  );
  for (const item of all.Items ?? []) console.log(`  ${item.timestamp}  ${item.event}`);

  // --- Query by PK + SK range ---
  console.log("\n=== Query: u1 events on 2024-01-01 ===");
  const oneDay = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "user_id = :u AND begins_with(#ts, :d)",
      ExpressionAttributeNames: { "#ts": "timestamp" }, // 'timestamp' is reserved
      ExpressionAttributeValues: { ":u": "u1", ":d": "2024-01-01" },
    })
  );
  for (const item of oneDay.Items ?? []) console.log(`  ${item.timestamp}  ${item.event}`);

  // --- Query with FilterExpression ---
  // The filter runs AFTER DynamoDB fetches the partition — it doesn't reduce RCUs.
  console.log("\n=== Query: u1 events, filter to purchases only ===");
  const purchases = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "user_id = :u",
      FilterExpression: "#e = :ev",
      ExpressionAttributeNames: { "#e": "event" },
      ExpressionAttributeValues: { ":u": "u1", ":ev": "purchase" },
    })
  );
  for (const item of purchases.Items ?? []) console.log(`  ${item.timestamp}  amount=${item.amount}`);

  // --- Scan (reads the entire table) ---
  // Avoid on large tables — it reads every item. Fine for small/admin datasets.
  console.log("\n=== Scan: all purchases across all users ===");
  const scan = await doc.send(
    new ScanCommand({ TableName: TABLE, FilterExpression: "#e = :ev", ExpressionAttributeNames: { "#e": "event" }, ExpressionAttributeValues: { ":ev": "purchase" } })
  );
  for (const item of scan.Items ?? []) console.log(`  user=${item.user_id}  ts=${item.timestamp}  amount=${item.amount}`);

  // --- Scan with projection (fetch only specific attributes) ---
  console.log("\n=== Scan with projection (user_id + event only) ===");
  const projected = await doc.send(
    new ScanCommand({ TableName: TABLE, ProjectionExpression: "user_id, #e", ExpressionAttributeNames: { "#e": "event" } })
  );
  for (const item of projected.Items ?? []) console.log(`  ${JSON.stringify(item)}`);

  // --- Cleanup ---
  await base.send(new DeleteTableCommand({ TableName: TABLE }));
  console.log(`\nCleaned up table '${TABLE}'`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
