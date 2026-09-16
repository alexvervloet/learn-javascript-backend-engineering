import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
  DeleteTableCommand,
} from "@aws-sdk/client-dynamodb";
import { config } from "../helpers.js";

// Every field on an AWS SDK response is optional: the service is free to omit
// one, and the SDK's types say so. The reads below use ?. rather than
// pretending otherwise.

const db = new DynamoDBClient(config);
const TABLE = "orders";

async function main() {
  // --- Create table with a composite key ---
  // PK = user_id, SK = order_id → "all orders for a user" is a natural query.
  console.log("=== Creating table ===");
  await db.send(
    new CreateTableCommand({
      TableName: TABLE,
      KeySchema: [
        { AttributeName: "user_id", KeyType: "HASH" }, // partition key
        { AttributeName: "order_id", KeyType: "RANGE" }, // sort key
      ],
      AttributeDefinitions: [
        { AttributeName: "user_id", AttributeType: "S" },
        { AttributeName: "order_id", AttributeType: "S" },
        { AttributeName: "status", AttributeType: "S" }, // needed for the GSI below
      ],
      // GSI: query orders by status regardless of user_id.
      GlobalSecondaryIndexes: [
        {
          IndexName: "status-index",
          KeySchema: [{ AttributeName: "status", KeyType: "HASH" }],
          Projection: { ProjectionType: "ALL" },
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        },
      ],
      BillingMode: "PROVISIONED",
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    })
  );
  console.log(`Table '${TABLE}' created`);

  // --- Describe ---
  console.log("\n=== Describing table ===");
  const { Table } = await db.send(new DescribeTableCommand({ TableName: TABLE }));
  console.log(`  Status:     ${Table?.TableStatus}`);
  console.log(`  Item count: ${Table?.ItemCount}`);
  console.log(`  Key schema: ${JSON.stringify(Table?.KeySchema)}`);
  console.log(`  GSIs:       ${JSON.stringify((Table?.GlobalSecondaryIndexes ?? []).map((g) => g.IndexName))}`);

  // --- List all tables ---
  console.log("\n=== Listing tables ===");
  const { TableNames } = await db.send(new ListTablesCommand({}));
  console.log(`  ${JSON.stringify(TableNames)}`);

  // --- Cleanup ---
  await db.send(new DeleteTableCommand({ TableName: TABLE }));
  console.log(`\nDeleted table '${TABLE}'`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
