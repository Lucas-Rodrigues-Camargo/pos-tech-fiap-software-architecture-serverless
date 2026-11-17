import assert from "node:assert/strict";
import test from "node:test";
import { createHandler } from "./index.mjs";

test("auth queries OS API and passes internal credential and correlation", async () => {
  const original = globalThis.fetch;
  const savedUrl = process.env.CUSTOMER_API_URL;
  const savedKey = process.env.INTERNAL_API_KEY;
  process.env.CUSTOMER_API_URL = "http://os/internal/auth/customers";
  process.env.INTERNAL_API_KEY = "test-only";
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, process.env.CUSTOMER_API_URL);
      assert.equal(options.headers["X-Internal-Key"], "test-only");
      assert.equal(options.headers["X-Correlation-ID"], "correlation");
      return { ok: true, json: async () => ({ id: "id", name: "Test", document: "52998224725", is_active: true }) };
    };
    const handler = createHandler({ signToken: () => "jwt" });
    const result = await handler({ body: '{"cpf":"52998224725"}', requestContext: { requestId: "correlation" } });
    assert.equal(result.statusCode, 200);
  } finally {
    globalThis.fetch = original;
    if (savedUrl === undefined) delete process.env.CUSTOMER_API_URL; else process.env.CUSTOMER_API_URL = savedUrl;
    if (savedKey === undefined) delete process.env.INTERNAL_API_KEY; else process.env.INTERNAL_API_KEY = savedKey;
  }
});
