import {
  SQSClient,
  CreateQueueCommand,
  SendMessageCommand,
  SendMessageBatchCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
} from "@aws-sdk/client-sqs";
import { config } from "../helpers.js";

// Every field on an AWS SDK response is optional: the service is free to omit
// one, and the SDK's types say so. The reads below use ?. rather than
// pretending otherwise.

const sqs = new SQSClient(config);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const { QueueUrl: url } = await sqs.send(
    new CreateQueueCommand({ QueueName: "demo", Attributes: { VisibilityTimeout: "5" } })
  );

  // --- Send messages ---
  console.log("=== Sending messages ===");
  await sqs.send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify({ job: "resize_image", id: 1 }) }));
  await sqs.send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify({ job: "send_email", id: 2 }) }));
  await sqs.send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify({ job: "resize_image", id: 3 }) }));

  // Message attributes carry metadata separate from the body.
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: url,
      MessageBody: JSON.stringify({ job: "generate_report", id: 4 }),
      MessageAttributes: {
        priority: { DataType: "String", StringValue: "high" },
        retry_count: { DataType: "Number", StringValue: "0" },
      },
    })
  );
  console.log("Sent 4 messages");

  // --- Batch send (up to 10 per call) ---
  console.log("\n=== Batch send ===");
  await sqs.send(
    new SendMessageBatchCommand({
      QueueUrl: url,
      Entries: Array.from({ length: 3 }, (_, i) => ({
        Id: String(i),
        MessageBody: JSON.stringify({ job: "task", id: 10 + i }),
      })),
    })
  );
  console.log("Batch sent 3 more messages");

  // --- Receive messages ---
  // MaxNumberOfMessages: up to 10. WaitTimeSeconds: long poll up to N seconds.
  console.log("\n=== Receiving messages ===");
  const { Messages = [] } = await sqs.send(
    new ReceiveMessageCommand({ QueueUrl: url, MaxNumberOfMessages: 5, WaitTimeSeconds: 1, MessageAttributeNames: ["All"] })
  );
  console.log(`Received ${Messages?.length} messages:`);
  for (const msg of Messages) {
    const body = JSON.parse(msg.Body ?? "{}");
    console.log(`  [${body.id}] ${body.job}  attrs=${JSON.stringify(Object.keys(msg.MessageAttributes ?? {}))}`);
  }

  // Received messages are now invisible to other consumers (VisibilityTimeout=5s).
  // You must delete them after success, or they reappear.
  console.log("\n=== Deleting processed messages ===");
  for (const msg of Messages) {
    await sqs.send(new DeleteMessageCommand({ QueueUrl: url, ReceiptHandle: msg.ReceiptHandle }));
  }
  console.log(`Deleted ${Messages?.length} messages`);

  // --- Visibility timeout demo ---
  console.log("\n=== Visibility timeout demo ===");
  const first = await sqs.send(new ReceiveMessageCommand({ QueueUrl: url, MaxNumberOfMessages: 1, WaitTimeSeconds: 1 }));
  // Messages is optional and may be empty — a receive can legitimately return
  // nothing, which is the whole point of long polling.
  const msg = first.Messages?.[0];
  if (!msg) throw new Error("Expected a message to be available");
  console.log(`Received: ${msg.Body} — NOT deleting it, simulating a crash...`);

  await sleep(6000); // VisibilityTimeout=5s → message reappears after 5s
  const retry = await sqs.send(new ReceiveMessageCommand({ QueueUrl: url, MaxNumberOfMessages: 1, WaitTimeSeconds: 1 }));
  if (retry.Messages?.length) {
    console.log(`Message reappeared for retry: ${retry.Messages[0].Body}`);
    await sqs.send(new DeleteMessageCommand({ QueueUrl: url, ReceiptHandle: retry.Messages[0].ReceiptHandle }));
  }

  // --- Cleanup ---
  const leftover = await sqs.send(new ReceiveMessageCommand({ QueueUrl: url, MaxNumberOfMessages: 10, WaitTimeSeconds: 1 }));
  for (const m of leftover.Messages ?? []) {
    await sqs.send(new DeleteMessageCommand({ QueueUrl: url, ReceiptHandle: m.ReceiptHandle }));
  }
  await sqs.send(new DeleteQueueCommand({ QueueUrl: url }));
  console.log("\nCleaned up queue");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
