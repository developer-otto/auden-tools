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

test("auto routing hands off to a specialist with recent history and preserves citations", async (t) => {
  const apiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-specialist-key";
  t.after(() => {
    if (apiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = apiKey;
  });

  const turns = [
    { role: "user", content: "My code uses a map." },
    { role: "assistant", content: "What would you like to know about it?" },
    { role: "user", content: "Why does it return undefined?" },
  ];
  const upstream = t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      const request = JSON.parse(String(options.body));
      assert.equal(request.model, "gpt-6.2-astra");
      assert.equal(request.store, false);
      assert.equal(request.reasoning.effort, "high");
      assert.ok(
        request.tools.some(
          ({ type }: { type: string }) => type === "web_search",
        ),
      );
      assert.deepEqual(
        request.input
          .slice(0, 3)
          .map(
            ({
              role,
              content,
            }: {
              role: string;
              content: { text: string }[];
            }) => ({ role, content: content[0]?.text }),
          ),
        turns,
      );

      const firstCall = upstream.mock.callCount() === 0;
      const transfer = "transfer_to_coding";
      if (firstCall) {
        assert.match(request.instructions, /first hand off/);
        assert.ok(
          request.tools.some(({ name }: { name: string }) => name === transfer),
        );
      } else {
        assert.match(request.instructions, /propose concrete fixes/);
        assert.ok(
          !request.tools.some(
            ({ name }: { name: string }) => name === transfer,
          ),
        );
        assert.ok(
          request.input.some(
            ({ type }: { type: string }) => type === "function_call_output",
          ),
        );
      }
      return Response.json({
        id: firstCall ? "resp_router" : "resp_specialist",
        object: "response",
        status: "completed",
        output: firstCall
          ? [
              {
                id: "fc_coding",
                type: "function_call",
                status: "completed",
                call_id: "call_coding",
                name: transfer,
                arguments: "{}",
              },
            ]
          : [
              {
                id: "msg_coding",
                type: "message",
                role: "assistant",
                status: "completed",
                content: [
                  {
                    type: "output_text",
                    text: "Check if the key exists.",
                    annotations: [
                      {
                        type: "url_citation",
                        start_index: 0,
                        end_index: 24,
                        title: "Map documentation",
                        url: "https://example.test/map",
                      },
                    ],
                  },
                ],
              },
            ],
      });
    },
  );

  const response = await POST(
    new Request("http://localhost/api/agents", {
      method: "POST",
      headers: { "x-agents-access-code": "test-access-code" },
      body: JSON.stringify({
        action: "chat",
        type: "auto",
        model: "gpt-6.2-astra",
        effort: "high",
        webSearch: true,
        turns,
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    text: "Check if the key exists.",
    responder: "coding",
    citations: [
      { end: 24, title: "Map documentation", url: "https://example.test/map" },
    ],
  });
  assert.equal(upstream.mock.callCount(), 2);
});

test("site tools return calculated dates, DST candidates, decimals, and dated rates", async (t) => {
  const apiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-site-tools-key";
  t.after(() => {
    if (apiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = apiKey;
  });

  const calls = [
    {
      name: "date_add_days",
      arguments: { date: "2024-02-28", days: 2 },
      result: { date: "2024-03-01" },
    },
    {
      name: "date_days_between",
      arguments: { start: "2024-02-28", end: "2024-03-01" },
      result: { days: 2 },
    },
    {
      name: "convert_time_zone",
      arguments: {
        local: "2026-11-01T01:30",
        from: "America/New_York",
        to: "Asia/Shanghai",
      },
      result: {
        from: "America/New_York",
        to: "Asia/Shanghai",
        ambiguous: true,
        candidates: [
          {
            utc: "2026-11-01T05:30:00.000Z",
            local: "2026-11-01T13:30:00",
            sourceOffset: "UTC-4",
            targetOffset: "UTC+8",
          },
          {
            utc: "2026-11-01T06:30:00.000Z",
            local: "2026-11-01T14:30:00",
            sourceOffset: "UTC-5",
            targetOffset: "UTC+8",
          },
        ],
      },
    },
    {
      name: "convert_unit",
      arguments: { amount: "12.5", from: "lb", to: "kg" },
      result: { value: "5.66990463", unit: "kg" },
    },
    {
      name: "convert_currency",
      arguments: { amount: "100", from: "USD", to: "CNY" },
      result: {
        value: "800.00",
        currency: "CNY",
        rate: "8.0000000000",
        rateDates: { USD: "2026-08-12" },
        source: "Frankfurter",
        sourceUrl: "https://frankfurter.dev/",
      },
    },
  ];
  let modelCalls = 0;
  let rateRequests = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      const endpoint = new URL(String(url));
      if (endpoint.hostname === "api.frankfurter.dev") {
        rateRequests++;
        assert.equal(endpoint.searchParams.get("base"), "CNY");
        assert.deepEqual([...endpoint.searchParams.keys()].sort(), [
          "base",
          "quotes",
        ]);
        return Response.json([
          { date: "2026-08-12", base: "CNY", quote: "USD", rate: 0.125 },
        ]);
      }
      assert.equal(endpoint.href, "https://api.openai.com/v1/responses");
      const request = JSON.parse(String(options.body));
      const turn = modelCalls++;
      assert.equal(request.store, false);
      assert.equal(request.previous_response_id, undefined);
      assert.deepEqual(
        request.tools.map(({ name }: { name: string }) => name),
        calls.map(({ name }) => name),
      );
      if (turn > 0) {
        const output = request.input.find(
          (item: { type: string; call_id: string }) =>
            item.type === "function_call_output" &&
            item.call_id === `call_${turn - 1}`,
        );
        assert.ok(output);
        assert.deepEqual(JSON.parse(output.output), calls[turn - 1]?.result);
      }
      const call = calls[turn];
      return Response.json({
        id: `resp_${turn}`,
        object: "response",
        status: "completed",
        output: call
          ? [
              {
                id: `fc_${turn}`,
                type: "function_call",
                status: "completed",
                call_id: `call_${turn}`,
                name: call.name,
                arguments: JSON.stringify(call.arguments),
              },
            ]
          : [
              {
                id: "msg_done",
                type: "message",
                role: "assistant",
                status: "completed",
                content: [
                  {
                    type: "output_text",
                    text: "Finished all conversions.",
                    annotations: [],
                  },
                ],
              },
            ],
      });
    },
  );

  const request = (siteTools: unknown) =>
    new Request("http://localhost/api/agents", {
      method: "POST",
      headers: { "x-agents-access-code": "test-access-code" },
      body: JSON.stringify({
        action: "chat",
        type: "chat",
        siteTools,
        turns: [
          {
            role: "user",
            content:
              "Calculate the two dates and convert the time, weight, and currency.",
          },
        ],
      }),
    });
  assert.equal((await POST(request("true"))).status, 400);
  const response = await POST(request(true));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    text: "Finished all conversions.",
  });
  assert.equal(modelCalls, calls.length + 1);
  assert.equal(rateRequests, 1);
});
