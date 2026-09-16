import {
  SQSClient,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SendMessageCommand,
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
  // --- Create a DLQ ---
  // A DLQ is just a normal queue; you wire it to a source queue via a redrive policy.
  console.log("=== Creating DLQ + source queue ===");
  const { QueueUrl: dlqUrl } = await sqs.send(new CreateQueueCommand({ QueueName: "jobs-dlq" }));
  const dlqAttrs = await sqs.send(new GetQueueAttributesCommand({ QueueUrl: dlqUrl, AttributeNames: ["QueueArn"] }));
  const dlqArn = dlqAttrs.Attributes?.QueueArn;
  console.log(`DLQ ARN: ${dlqArn}`);

  // maxReceiveCount=2: after 2 failed receives, SQS moves the message to the DLQ.
  const { QueueUrl: sourceUrl } = await sqs.send(
    new CreateQueueCommand({
      QueueName: "jobs",
      Attributes: {
        VisibilityTimeout: "2",
        RedrivePolicy: JSON.stringify({ deadLetterTargetArn: dlqArn, maxReceiveCount: "2" }),
      },
    })
  );
  console.log("Source queue with redrive policy created");

  // --- Seed a poison-pill message that always fails + one good message ---
  await sqs.send(new SendMessageCommand({ QueueUrl: sourceUrl, MessageBody: JSON.stringify({ job: "bad_job", willFail: true }) }));
  await sqs.send(new SendMessageCommand({ QueueUrl: sourceUrl, MessageBody: JSON.stringify({ job: "good_job", willFail: false }) }));
  console.log("\nSent 1 poison-pill + 1 good message");

  // The message body this demo sends: one field decides whether processing
  // 'fails' and the message ends up on the dead-letter queue.
  interface JobBody {
    willFail?: boolean;
  }

  const process = (msg: JobBody): boolean => !msg.willFail;

  // --- Simulate processing with failures ---
  // Each receive without a delete increments the receive count; after
  // maxReceiveCount, SQS moves the message to the DLQ automatically.
  console.log("\n=== Processing loop (simulating 3 rounds) ===");
  for (let round = 1; round <= 3; round += 1) {
    console.log(`\n--- Round ${round} ---`);
    await sleep(2000); // wait for the visibility timeout to expire
    const { Messages = [] } = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: sourceUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 1,
        // ApproximateReceiveCount is a *message* system attribute, not a queue
        // attribute. The legacy AttributeNames parameter is typed as
        // QueueAttributeName[], so asking for it there does not typecheck —
        // MessageSystemAttributeNames is the field that carries it.
        MessageSystemAttributeNames: ["ApproximateReceiveCount"],
      })
    );
    if (!Messages?.length) {
      console.log("  No messages available");
      continue;
    }
    for (const msg of Messages) {
      const body = JSON.parse(msg.Body ?? "{}");
      const receiveCount = Number(msg.Attributes?.ApproximateReceiveCount);
      const success = process(body);
      console.log(`  job=${body.job}  receiveCount=${receiveCount}  success=${success}`);
      if (success) {
        await sqs.send(new DeleteMessageCommand({ QueueUrl: sourceUrl, ReceiptHandle: msg.ReceiptHandle }));
        console.log("    → Deleted (processed successfully)");
      } else {
        console.log(`    → NOT deleted (DLQ after ${2 - receiveCount} more failure(s))`);
      }
    }
  }

  // --- Inspect the DLQ ---
  console.log("\n=== Inspecting DLQ ===");
  await sleep(3000);
  const { Messages: dlqMsgs = [] } = await sqs.send(
    new ReceiveMessageCommand({ QueueUrl: dlqUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 2 })
  );
  console.log(`Messages in DLQ: ${dlqMsgs.length}`);
  for (const msg of dlqMsgs) console.log(`  ${msg.Body}`);

  // In production you'd inspect the DLQ, fix the bug, then redrive to the source.

  // --- Cleanup ---
  await sqs.send(new DeleteQueueCommand({ QueueUrl: sourceUrl }));
  await sqs.send(new DeleteQueueCommand({ QueueUrl: dlqUrl }));
  console.log("\nCleaned up queues");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
