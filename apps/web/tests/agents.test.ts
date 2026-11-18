import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/agents/route.ts";

test("only authorized, validated turns are sent to OpenAI without response storage", async (t) => {
  const code = "test-access-code";
  const originalModel = process.env.OPENAI_AGENTS_MODEL;
  delete process.env.OPENAI_AGENTS_MODEL;
  t.after(() => {
    if (originalModel !== undefined)
      process.env.OPENAI_AGENTS_MODEL = originalModel;
  });
  const upstream = t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      assert.equal(
        new Headers(options.headers).get("authorization"),
        `Bearer ${code}`,
      );
      const request = JSON.parse(String(options.body));
      assert.equal(request.store, false);
      assert.equal(request.model, "gpt-6.2-astra");
      assert.deepEqual(request.reasoning, { effort: "high" });
      assert.match(request.instructions, /propose concrete fixes/);
      assert.deepEqual(request.input, [{ role: "user", content: "hello" }]);
      return Response.json({
        object: "response",
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

  const chat = {
    action: "chat",
    model: "gpt-6.2-astra",
    type: "coding",
    effort: "high",
    turns: [{ role: "user", content: "hello", extra: true }],
  };
  assert.equal((await POST(request("", chat))).status, 401);
  assert.equal(
    (await POST(request(code, { ...chat, type: "toString" }))).status,
    400,
  );
  assert.equal(
    (await POST(request(code, { ...chat, model: "unknown-model" }))).status,
    400,
  );
  assert.equal(
    (
      await POST(
        request(code, {
          ...chat,
          turns: [{ role: "developer", content: "hello" }],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await POST(request(code, { ...chat, effort: "none" }))).status,
    400,
  );
  assert.equal(upstream.mock.callCount(), 0);
  const response = await POST(request(code, chat));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { text: "hi" });
  assert.equal(upstream.mock.callCount(), 1);
  assert.equal(
    (await POST(request(code, { ...chat, model: undefined }))).status,
    200,
  );
  assert.equal(upstream.mock.callCount(), 2);
});
