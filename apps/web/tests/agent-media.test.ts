import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { POST as chat } from "../app/api/agents/route.ts";
import { POST as speech } from "../app/api/agents/speech/route.ts";
import { POST as transcribe } from "../app/api/agents/transcribe/route.ts";
import { maxAgentAudioBytes } from "../lib/agent-media.ts";

const serverKey = "test-media-server-key";
const previousKey = process.env.OPENAI_API_KEY;
beforeEach(() => {
  process.env.OPENAI_API_KEY = serverKey;
});
afterEach(() => {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
});

const request = (body: BodyInit, type: string, access = "test-media-access") =>
  new Request("https://example.test/api/agents", {
    method: "POST",
    body,
    headers: { "x-agents-access-code": access, "content-type": type },
  });

test("web search is opt-in and returns safe inline citations", async (t) => {
  const upstream = t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      assert.deepEqual(JSON.parse(String(options.body)).tools, [
        { type: "web_search" },
      ]);
      return Response.json({
        object: "response",
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: "你好", annotations: [] },
              {
                type: "output_text",
                text: "🌎。",
                annotations: [
                  {
                    type: "url_citation",
                    end_index: 1,
                    title: "Source",
                    url: "https://example.test/article",
                  },
                  {
                    type: "url_citation",
                    end_index: 2,
                    title: "Unsafe",
                    url: "javascript:alert(1)",
                  },
                ],
              },
            ],
          },
        ],
      });
    },
  );
  const body = {
    action: "chat",
    type: "chat",
    webSearch: true,
    turns: [{ role: "user", content: "Hello" }],
  };
  assert.equal(
    (
      await chat(
        request(
          JSON.stringify({ ...body, webSearch: "true" }),
          "application/json",
        ),
      )
    ).status,
    400,
  );
  assert.equal(upstream.mock.callCount(), 0);
  const response = await chat(
    request(JSON.stringify(body), "application/json"),
  );
  assert.deepEqual(await response.json(), {
    text: "你好🌎。",
    citations: [
      { end: 3, title: "Source", url: "https://example.test/article" },
    ],
  });
});

test("audio endpoints use the server key and reject oversized or unsupported recordings", async (t) => {
  const upstream = t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(
        new Headers(options.headers).get("authorization"),
        `Bearer ${serverKey}`,
      );
      if (String(url).endsWith("/transcriptions")) {
        const body = options.body as FormData;
        assert.equal(body.get("model"), "gpt-transcribe");
        assert.equal((body.get("file") as File).name, "audio.webm");
        return Response.json({ text: "dictated text" });
      }
      assert.ok(String(url).endsWith("/speech"));
      assert.deepEqual(JSON.parse(String(options.body)), {
        model: "gpt-4o-mini-tts",
        voice: "coral",
        input: "Read me",
        response_format: "mp3",
      });
      return new Response("audio bytes", {
        headers: { "Content-Type": "audio/mpeg" },
      });
    },
  );
  assert.equal((await transcribe(request("voice", "text/plain"))).status, 415);
  assert.equal(
    (
      await transcribe(
        request(new Uint8Array(maxAgentAudioBytes + 1), "audio/webm"),
      )
    ).status,
    413,
  );
  assert.equal(
    (await speech(request("Read me", "text/plain", ""))).status,
    401,
  );
  assert.equal(upstream.mock.callCount(), 0);
  const transcript = await transcribe(
    request("voice", "audio/webm;codecs=opus"),
  );
  assert.deepEqual(await transcript.json(), { text: "dictated text" });
  assert.equal(transcript.headers.get("cache-control"), "no-store");
  const audio = await speech(request("Read me", "text/plain"));
  assert.equal(audio.headers.get("content-type"), "audio/mpeg");
  assert.equal(await audio.text(), "audio bytes");
});
