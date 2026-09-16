import type { QueueAttributeName } from "@aws-sdk/client-sqs";
import {
  SQSClient,
  CreateQueueCommand,
  ListQueuesCommand,
  GetQueueAttributesCommand,
  DeleteQueueCommand,
} from "@aws-sdk/client-sqs";
import { config } from "../helpers.js";

const sqs = new SQSClient(config);

async function main() {
  // --- Standard queue ---
  console.log("=== Creating a standard queue ===");
  const jobs = await sqs.send(
    new CreateQueueCommand({
      QueueName: "jobs",
      Attributes: {
        VisibilityTimeout: "30", // seconds a message is hidden after receive
        MessageRetentionPeriod: "86400", // keep messages for 1 day
        ReceiveMessageWaitTimeSeconds: "20", // long polling
      },
    })
  );
  const jobsUrl = jobs.QueueUrl;
  console.log(`Created: ${jobsUrl}`);

  // --- FIFO queue ---
  // FIFO queues guarantee order and exactly-once processing within a message
  // group. They require the .fifo suffix and a MessageGroupId on every message.
  console.log("\n=== Creating a FIFO queue ===");
  const payments = await sqs.send(
    new CreateQueueCommand({
      QueueName: "payments.fifo",
      Attributes: { FifoQueue: "true", ContentBasedDeduplication: "true" },
    })
  );
  const paymentsUrl = payments.QueueUrl;
  console.log(`Created: ${paymentsUrl}`);

  // --- List queues ---
  console.log("\n=== Listing queues ===");
  const { QueueUrls = [] } = await sqs.send(new ListQueuesCommand({}));
  for (const url of QueueUrls) console.log(`  ${url}`);

  // --- Read attributes ---
  console.log("\n=== Queue attributes for 'jobs' ===");
  const { Attributes } = await sqs.send(new GetQueueAttributesCommand({ QueueUrl: jobsUrl, AttributeNames: ["All"] }));
  // The SDK keys queue attributes by its own QueueAttributeName union, so the
  // list below is typed as that rather than as plain strings.
  const keys: QueueAttributeName[] = [
    "VisibilityTimeout",
    "MessageRetentionPeriod",
    "ApproximateNumberOfMessages",
  ];
  for (const key of keys) {
    console.log(`  ${key}: ${Attributes?.[key]}`);
  }

  // --- Cleanup ---
  await sqs.send(new DeleteQueueCommand({ QueueUrl: jobsUrl }));
  await sqs.send(new DeleteQueueCommand({ QueueUrl: paymentsUrl }));
  console.log("\nDeleted both queues");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
