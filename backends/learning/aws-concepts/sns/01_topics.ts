import {
  SNSClient,
  CreateTopicCommand,
  ListTopicsCommand,
  GetTopicAttributesCommand,
  SetTopicAttributesCommand,
  DeleteTopicCommand,
} from "@aws-sdk/client-sns";
import { config } from "../helpers.js";

// Every field on an AWS SDK response is optional: the service is free to omit
// one, and the SDK's types say so. The reads below use ?. rather than
// pretending otherwise.

const sns = new SNSClient(config);

async function main() {
  // --- Create topics ---
  console.log("=== Creating topics ===");
  const { TopicArn: ordersArn } = await sns.send(new CreateTopicCommand({ Name: "order-events" }));
  const { TopicArn: alertsArn } = await sns.send(new CreateTopicCommand({ Name: "system-alerts" }));
  console.log(`order-events ARN: ${ordersArn}`);
  console.log(`system-alerts ARN: ${alertsArn}`);

  // --- List topics ---
  console.log("\n=== Listing topics ===");
  const { Topics = [] } = await sns.send(new ListTopicsCommand({}));
  for (const topic of Topics) console.log(`  ${topic.TopicArn}`);

  // --- Get topic attributes ---
  console.log("\n=== Topic attributes ===");
  const { Attributes } = await sns.send(new GetTopicAttributesCommand({ TopicArn: ordersArn }));
  for (const key of ["TopicArn", "DisplayName", "SubscriptionsConfirmed", "SubscriptionsPending"]) {
    console.log(`  ${key}: ${Attributes?.[key] ?? "—"}`);
  }

  // --- Set display name ---
  await sns.send(new SetTopicAttributesCommand({ TopicArn: ordersArn, AttributeName: "DisplayName", AttributeValue: "Order Events" }));
  const updated = await sns.send(new GetTopicAttributesCommand({ TopicArn: ordersArn }));
  console.log(`\nDisplayName updated to: '${updated.Attributes?.DisplayName}'`);

  // --- Delete ---
  console.log("\n=== Deleting topics ===");
  await sns.send(new DeleteTopicCommand({ TopicArn: ordersArn }));
  await sns.send(new DeleteTopicCommand({ TopicArn: alertsArn }));
  const { Topics: remaining = [] } = await sns.send(new ListTopicsCommand({}));
  console.log(`Remaining topics: ${remaining.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
