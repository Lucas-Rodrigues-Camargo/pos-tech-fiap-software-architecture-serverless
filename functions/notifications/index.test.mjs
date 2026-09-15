import assert from "node:assert/strict";
import test from "node:test";
import { createHandler } from "./index.mjs";

test("sends valid SQS notification events", async () => {
  const sent = [];
  const handler = createHandler({ sendEmail: async (message) => sent.push(message) });
  const result = await handler({ Records: [{ messageId: "1", body: JSON.stringify({ customerEmail: "client@example.com", orderNumber: "OS-1", orderId: "id", status: "WaitingApproval" }) }] });
  assert.deepEqual(result.batchItemFailures, []);
  assert.equal(sent[0].Destination.ToAddresses[0], "client@example.com");
});

test("reports partial batch failures", async () => {
  const handler = createHandler({ sendEmail: async () => undefined });
  const result = await handler({ Records: [{ messageId: "bad", body: "{}" }] });
  assert.deepEqual(result.batchItemFailures, [{ itemIdentifier: "bad" }]);
});

