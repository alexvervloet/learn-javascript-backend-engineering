import {
  DynamoDBClient,
  CreateTableCommand,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  ScanCommand,
  DeleteTableCommand,
} from "@aws-sdk/client-dynamodb";
import { config } from "../helpers.js";

// Every field on an AWS SDK response is optional: the service is free to omit
// one, and the SDK's types say so. The reads below use ?. rather than
// pretending otherwise.

// Raw client: items are attribute-value maps ({ S: "..." }, { N: "1" }), the
// DynamoDB wire format. Section 03 uses the Document client to skip this.
const db = new DynamoDBClient(config);
const TABLE = "products";

async function main() {
  await db.send(
    new CreateTableCommand({
      TableName: TABLE,
      KeySchema: [{ AttributeName: "product_id", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "product_id", AttributeType: "S" }],
      BillingMode: "PAY_PER_REQUEST",
    })
  );

  // --- PutItem (insert or fully replace) ---
  console.log("=== PutItem ===");
  await db.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        product_id: { S: "prod-001" },
        name: { S: "Wireless Headphones" },
        price: { N: "79.99" },
        stock: { N: "150" },
        tags: { SS: ["electronics", "audio"] },
        in_stock: { BOOL: true },
      },
    })
  );
  await db.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        product_id: { S: "prod-002" },
        name: { S: "USB-C Cable" },
        price: { N: "12.99" },
        stock: { N: "500" },
        in_stock: { BOOL: true },
      },
    })
  );
  console.log("Inserted prod-001 and prod-002");

  // --- GetItem ---
  console.log("\n=== GetItem ===");
  const { Item } = await db.send(new GetItemCommand({ TableName: TABLE, Key: { product_id: { S: "prod-001" } } }));
  console.log(`  name:  ${Item?.name.S}`);
  console.log(`  price: ${Item?.price.N}`);
  console.log(`  tags:  ${JSON.stringify(Item?.tags.SS)}`);

  // --- UpdateItem with expressions ---
  // SET adds/updates attributes, ADD increments numbers, REMOVE deletes them.
  console.log("\n=== UpdateItem ===");
  await db.send(
    new UpdateItemCommand({
      TableName: TABLE,
      Key: { product_id: { S: "prod-001" } },
      UpdateExpression: "SET price = :p, #n = :n ADD stock :delta",
      ExpressionAttributeValues: {
        ":p": { N: "69.99" }, // price drop
        ":n": { S: "Wireless Headphones Pro" },
        ":delta": { N: "-10" }, // sold 10 units
      },
      ExpressionAttributeNames: { "#n": "name" }, // 'name' is a reserved word
    })
  );
  const updated = await db.send(new GetItemCommand({ TableName: TABLE, Key: { product_id: { S: "prod-001" } } }));
  console.log(`  new name:  ${updated.Item?.name.S}`);
  console.log(`  new price: ${updated.Item?.price.N}`);
  console.log(`  new stock: ${updated.Item?.stock.N}`);

  // --- Conditional update (optimistic-locking pattern) ---
  // Apply only if the condition holds; throws ConditionalCheckFailedException otherwise.
  console.log("\n=== Conditional UpdateItem ===");
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: { product_id: { S: "prod-001" } },
        UpdateExpression: "SET in_stock = :false",
        ConditionExpression: "stock = :zero",
        ExpressionAttributeValues: { ":false": { BOOL: false }, ":zero": { N: "0" } },
      })
    );
  } catch (err) {
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      console.log("  Condition failed: stock is not 0, in_stock not changed (correct)");
    } else {
      throw err;
    }
  }

  // --- DeleteItem ---
  console.log("\n=== DeleteItem ===");
  await db.send(new DeleteItemCommand({ TableName: TABLE, Key: { product_id: { S: "prod-002" } } }));
  console.log("  Deleted prod-002");

  const { Items } = await db.send(new ScanCommand({ TableName: TABLE }));
  console.log(`  Items remaining: ${JSON.stringify(Items?.map((i) => i.product_id.S))}`);

  // --- Cleanup ---
  await db.send(new DeleteTableCommand({ TableName: TABLE }));
  console.log(`\nCleaned up table '${TABLE}'`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
