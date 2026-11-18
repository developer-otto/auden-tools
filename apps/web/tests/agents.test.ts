import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/agents/route.ts";

test("only authorized, validated turns are sent to OpenAI without response storage", async (t) => {
  const code = "test-access-code-at-least-24-characters";
  process.env.AUDEN_AGENTS_ACCESS_CODE = code;
  process.env.OPENAI_API_KEY = "test-key";
  t.after(() => {
    delete process.env.AUDEN_AGENTS_ACCESS_CODE;
    delete process.env.OPENAI_API_KEY;
  });
  const upstream = t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      const request = JSON.parse(String(options.body));
      assert.equal(request.store, false);
      assert.deepEqual(request.input, [{ role: "user", content: "hello" }]);
      return Response.json({
        output: [
          { type: "message", content: [{ type: "output_text", text: "hi" }] },
        ],
      });
    },
  );
  const request = (access: string, body: unknown) =>
    new Request("http://localhost/api/agents", {
      method: "POST",
      headers: { "x-agents-access-code": access },
      body: JSON.stringify(body),
    });

  assert.equal((await POST(request("wrong", []))).status, 401);
  assert.equal(
    (await POST(request(code, [{ role: "developer", content: "hello" }])))
      .status,
    400,
  );
  assert.equal(upstream.mock.callCount(), 0);
  const response = await POST(
    request(code, [{ role: "user", content: "hello", extra: true }]),
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { text: "hi" });
  assert.equal(upstream.mock.callCount(), 1);
});
