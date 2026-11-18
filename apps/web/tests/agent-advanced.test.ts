import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { POST } from "../app/api/agents/route.ts";
import { agentStreamType, readAgentStream } from "../lib/agent-stream.ts";
import { streamAgentReply } from "../lib/server/agent-stream-response.ts";

const serverKey = "test-advanced-server-key";
const previousKey = process.env.OPENAI_API_KEY;
beforeEach(() => {
  process.env.OPENAI_API_KEY = serverKey;
});
afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
});

const replyMessage = {
  id: "msg_1",
  type: "message",
  role: "assistant",
  status: "completed",
  content: [{ type: "output_text", text: "Hello world.", annotations: [] }],
};
const webp = "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==";

function request(body: object = {}, access = "test-access-code", accept?: string) {
  return new Request("http://localhost/api/agents", {
    method: "POST",
    headers: { "x-agents-access-code": access, ...(accept ? { accept } : {}) },
    body: JSON.stringify({
      action: "chat",
      model: "gpt-6.2-astra",
      type: "chat",
      turns: [{ role: "user", content: "Hello" }],
      ...body,
    }),
  });
}

test("disconnecting a chat stream aborts the in-flight agent request", async () => {
  const client = new AbortController();
  const { promise: aborted, resolve } = Promise.withResolvers<void>();
  const response = streamAgentReply(client.signal, (signal, emit) => {
    emit({ type: "tool" });
    return new Promise((_resolve, reject) => {
      signal.addEventListener(
        "abort",
        () => {
          resolve();
          reject(signal.reason);
        },
        { once: true },
      );
    });
  });
  const reader = response.body?.getReader();
  assert.ok(reader);
  assert.equal((await reader.read()).done, false);
  await reader.cancel();
  await aborted;
});

test("chat streams deltas and a final reply while keeping response storage off", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(options.body));
      assert.equal(body.stream, true);
      assert.equal(body.store, false);
      const response = { id: "resp_1", object: "response" };
      const events = [
        {
          type: "response.created",
          response: { ...response, status: "in_progress", output: [] },
        },
        {
          type: "response.output_item.added",
          output_index: 0,
          item: { ...replyMessage, content: [] },
        },
        {
          type: "response.output_text.delta",
          output_index: 0,
          content_index: 0,
          item_id: "msg_1",
          delta: "Hello ",
        },
        {
          type: "response.output_text.delta",
          output_index: 0,
          content_index: 0,
          item_id: "msg_1",
          delta: "world.",
        },
        {
          type: "response.completed",
          response: {
            ...response,
            status: "completed",
            output: [replyMessage],
          },
        },
      ];
      return new Response(
        events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
        {
          headers: { "content-type": "text/event-stream" },
        },
      );
    },
  );
  const response = await POST(request({}, "test-access-code", agentStreamType));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-type") ?? "", /x-ndjson/);
  const events: unknown[] = [];
  const result = await readAgentStream(response, (event) => events.push(event));
  assert.deepEqual(events, [
    { type: "delta", text: "Hello " },
    { type: "delta", text: "world." },
  ]);
  assert.deepEqual(result, { type: "done", reply: { text: "Hello world." } });
});

test("advanced tools use the fixed docs MCP and share only validated inline attachments", async (t) => {
  const pdf = Buffer.from("%PDF-1.7\n%Test attachment").toString("base64");
  const attachment = {
    mime: "application/pdf",
    name: "reference.pdf",
    data: pdf,
  };
  const upstream = t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(options.body));
      assert.equal(body.store, false);
      assert.deepEqual(body.input[0].content[1], {
        type: "input_file",
        filename: "reference.pdf",
        file_data: `data:application/pdf;base64,${pdf}`,
      });
      const tools = new Map<string, Record<string, unknown>>(
        body.tools.map((tool: { type: string }) => [tool.type, tool]),
      );
      assert.equal(tools.get("tool_search")?.execution, "client");
      assert.ok(tools.has("programmatic_tool_calling"));
      assert.equal(tools.get("image_generation")?.output_format, "webp");
      assert.equal(
        tools.get("mcp")?.server_url,
        "https://developers.openai.com/mcp",
      );
      assert.deepEqual(tools.get("mcp")?.allowed_tools, {
        tool_names: ["search_openai_docs"],
      });
      const functions = tools.get("namespace")?.tools as {
        defer_loading: boolean;
        allowed_callers: string[];
      }[];
      assert.equal(functions.length, 5);
      assert.ok(
        functions.every(
          (tool) =>
            tool.defer_loading &&
            tool.allowed_callers.join(",") === "direct,programmatic",
        ),
      );
      return Response.json({
        id: "resp_1",
        object: "response",
        status: "completed",
        output: [
          {
            id: "img_1",
            type: "image_generation_call",
            status: "completed",
            result: webp,
          },
          replyMessage,
        ],
      });
    },
  );

  assert.equal(
    (
      await POST(
        request({
          attachment: {
            ...attachment,
            data: Buffer.from("<html>").toString("base64"),
          },
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await POST(request({ advancedTools: ["programmatic"] }))).status,
    424,
  );
  assert.equal((await POST(request({ advancedTools: ["shell"] }))).status, 400);
  assert.equal(upstream.mock.callCount(), 0);
  const response = await POST(
    request({
      advancedTools: ["image", "docs", "discovery", "programmatic"],
      siteTools: true,
      attachment,
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    text: "Hello world.",
    image: webp,
  });
  assert.equal(upstream.mock.callCount(), 1);
});

test("access codes never become OpenAI credentials", async (t) => {
  const authorizations: (string | null)[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      authorizations.push(new Headers(options.headers).get("authorization"));
      return Response.json({ object: "response", output: [replyMessage] });
    },
  );
  assert.equal((await POST(request({}, ""))).status, 401);
  assert.equal((await POST(request({}, "test-access-code"))).status, 200);
  assert.equal((await POST(request({}, "sk-test-client-supplied"))).status, 200);
  assert.deepEqual(authorizations, [
    `Bearer ${serverKey}`,
    `Bearer ${serverKey}`,
  ]);
  delete process.env.OPENAI_API_KEY;
  assert.equal((await POST(request({}, "test-access-code"))).status, 503);
  assert.equal(authorizations.length, 2);
});

test("discovery loads an allowlisted tool and returns its result to the hosted program", async (t) => {
  const caller = { type: "program", caller_id: "call_program" };
  const outputs = [
    [
      {
        type: "tool_search_call",
        id: "ts_1",
        execution: "client",
        call_id: "call_search",
        status: "completed",
        arguments: { paths: ["auden.date_add_days"] },
      },
    ],
    [
      {
        type: "program",
        id: "prog_1",
        call_id: caller.caller_id,
        code: "/* hosted program test fixture */",
        fingerprint: "opaque-replay-state",
      },
      {
        type: "function_call",
        id: "fc_1",
        call_id: "call_date",
        namespace: "auden",
        name: "date_add_days",
        arguments: JSON.stringify({ date: "2026-12-31", days: 1 }),
        caller,
      },
    ],
    [
      {
        type: "program_output",
        id: "prog_out_1",
        call_id: caller.caller_id,
        status: "completed",
        result: '{"date":"2027-01-01"}',
      },
      replyMessage,
    ],
  ];
  const inputs: {
    input: Record<string, unknown>[];
    previous_response_id?: string;
  }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      const request = JSON.parse(String(options.body));
      const output = outputs[inputs.length];
      inputs.push(request);
      return Response.json({
        id: `resp_${inputs.length}`,
        object: "response",
        status: "completed",
        output,
      });
    },
  );

  const response = await POST(
    request({
      siteTools: true,
      advancedTools: ["discovery", "programmatic"],
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(inputs.length, 3);
  assert.ok(inputs.every((body) => !body.previous_response_id));
  const search = inputs[1]?.input.find(
    (item) => item.type === "tool_search_output",
  );
  assert.equal(search?.call_id, "call_search");
  const namespaces = search?.tools as {
    name: string;
    tools: { name: string }[];
  }[];
  assert.deepEqual(
    namespaces.map(({ name, tools }) => [name, tools.map((item) => item.name)]),
    [["auden", ["date_add_days"]]],
  );
  const result = inputs[2]?.input.find(
    (item) => item.type === "function_call_output",
  );
  assert.equal(result?.call_id, "call_date");
  assert.deepEqual(result?.caller, caller);
  assert.deepEqual(JSON.parse(String(result?.output)), { date: "2027-01-01" });
});
