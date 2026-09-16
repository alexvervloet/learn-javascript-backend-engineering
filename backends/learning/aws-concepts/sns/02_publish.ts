import { SNSClient, CreateTopicCommand, SubscribeCommand, PublishCommand, DeleteTopicCommand } from "@aws-sdk/client-sns";
import {
  SQSClient,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
  ReceiveMessageCommand,
  DeleteQueueCommand,
} from "@aws-sdk/client-sqs";
import { config } from "../helpers.js";

// Every field on an AWS SDK response is optional: the service is free to omit
// one, and the SDK's types say so. The reads below use ?. rather than
// pretending otherwise.

const sns = new SNSClient(config);
const sqs = new SQSClient(config);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  // Setup: a topic + one SQS subscriber so we can inspect what arrives.
  const { TopicArn: topicArn } = await sns.send(new CreateTopicCommand({ Name: "events" }));
  const { QueueUrl: queueUrl } = await sqs.send(new CreateQueueCommand({ QueueName: "events-inbox" }));
  const { Attributes } = await sqs.send(new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: ["QueueArn"] }));
  const queueArn = Attributes?.QueueArn;

  // Allow SNS to write to the SQS queue.
  await sqs.send(
    new SetQueueAttributesCommand({
      QueueUrl: queueUrl,
      Attributes: {
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: "sqs:SendMessage",
              Resource: queueArn,
              Condition: { ArnEquals: { "aws:SourceArn": topicArn } },
            },
          ],
        }),
      },
    })
  );
  await sns.send(new SubscribeCommand({ TopicArn: topicArn, Protocol: "sqs", Endpoint: queueArn }));

  // --- Basic publish ---
  console.log("=== Basic publish ===");
  const basic = await sns.send(new PublishCommand({ TopicArn: topicArn, Message: "Hello from SNS!" }));
  console.log(`MessageId: ${basic.MessageId}`);

  // --- Publish with Subject and MessageAttributes ---
  // MessageAttributes let subscribers filter without inspecting the body.
  console.log("\n=== Publish with attributes ===");
  const withAttrs = await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: "Order Placed",
      Message: JSON.stringify({ order_id: "ord-999", total: 79.99, user_id: "u1" }),
      MessageAttributes: {
        event_type: { DataType: "String", StringValue: "order.placed" },
        region: { DataType: "String", StringValue: "eu-west-1" },
        amount: { DataType: "Number", StringValue: "79.99" },
      },
    })
  );
  console.log(`Published order event: ${withAttrs.MessageId}`);

  // --- Read from the SQS queue to see what arrived ---
  await sleep(1000);
  console.log("\n=== Messages received in SQS ===");
  const { Messages = [] } = await sqs.send(new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: 2 }));
  for (const msg of Messages) {
    // SNS wraps the message in an envelope — the real body is in `Message`.
    const envelope = JSON.parse(msg.Body ?? "{}");
    console.log(`  Type:    ${envelope.Type}`);
    console.log(`  Subject: ${envelope.Subject ?? "—"}`);
    console.log(`  Message: ${envelope.Message}`);
    console.log();
  }

  // --- Cleanup ---
  await sns.send(new DeleteTopicCommand({ TopicArn: topicArn }));
  await sqs.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  console.log("Cleaned up.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
