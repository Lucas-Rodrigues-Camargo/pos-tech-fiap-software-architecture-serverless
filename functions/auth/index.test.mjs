import assert from "node:assert/strict";
import test from "node:test";
import { createHandler, isValidCpf, normalizeCpf } from "./index.mjs";

test("normalizes and validates CPF", () => {
  assert.equal(normalizeCpf("529.982.247-25"), "52998224725");
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
});

test("returns a customer token", async () => {
  const handler = createHandler({
    queryCustomer: async () => ({ id: "customer-id", name: "João", document: "52998224725", is_active: true }),
    signToken: (claims) => `token-for-${claims.sub}`
  });
  const result = await handler({ body: JSON.stringify({ cpf: "529.982.247-25" }) });
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).token, "token-for-customer-id");
});

test("rejects an inactive customer", async () => {
  const handler = createHandler({ queryCustomer: async () => ({ is_active: false }), signToken: () => "unused" });
  const result = await handler({ body: JSON.stringify({ cpf: "52998224725" }) });
  assert.equal(result.statusCode, 401);
});

