import { timingSafeEqual } from "node:crypto";
import OpenAI from "openai";

export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };
const fail = (status: number) =>
  Response.json({ error: true }, { status, headers });
const maxBytes = 32_768;

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error();
  const decoder = new TextDecoder();
  let length = 0;
  let body = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new Error();
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

type Turn = { role: "user" | "assistant"; content: string };

function isTurn(value: unknown): value is Turn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Partial<Turn>;
  return (
    (turn.role === "user" || turn.role === "assistant") &&
    typeof turn.content === "string" &&
    turn.content.trim().length > 0 &&
    turn.content.length <= 8000
  );
}

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  const access = process.env.AUDEN_AGENTS_ACCESS_CODE;
  if (!key || !access || access.length < 24) return fail(503);

  const given = Buffer.from(request.headers.get("x-agents-access-code") ?? "");
  const expected = Buffer.from(access);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return fail(401);

  let input: unknown;
  try {
    input = await readBody(request);
  } catch {
    return fail(400);
  }
  if (
    !Array.isArray(input) ||
    !input.length ||
    input.length > 9 ||
    !input.every(
      (turn, index) =>
        isTurn(turn) && turn.role === (index % 2 ? "assistant" : "user"),
    ) ||
    input.at(-1)?.role !== "user"
  )
    return fail(400);

  try {
    const client = new OpenAI({ apiKey: key, maxRetries: 0, timeout: 45_000 });
    const response = await client.responses.create(
      {
        model: process.env.OPENAI_AGENTS_MODEL?.trim() || "gpt-6.1-terra",
        instructions:
          "You are the Auden Tools assistant. Answer in the user's language. Help with questions, summaries, translations, and code explanations. You cannot access files, execute changes, or look up live information; do not claim otherwise.",
        input: input.map(({ role, content }: Turn) => ({ role, content })),
        store: false,
        max_output_tokens: 2048,
      },
      { signal: request.signal },
    );
    const text = response.output
      .flatMap((item) =>
        item.type === "message"
          ? item.content.map((part) =>
              part.type === "output_text" ? part.text : part.refusal,
            )
          : [],
      )
      .join("\n");
    return text ? Response.json({ text }, { headers }) : fail(502);
  } catch (error) {
    return fail(
      error instanceof OpenAI.APIError && error.status === 429 ? 429 : 502,
    );
  }
}
