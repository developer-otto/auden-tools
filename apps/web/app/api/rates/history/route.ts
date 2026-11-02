import { isCurrencyCode } from "../../../../lib/rates";
import { getRateHistory } from "../../../../lib/server/rates";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const base = params.get("base") || "CNY",
    quote = params.get("quote") || "USD";
  if (!isCurrencyCode(base) || !isCurrencyCode(quote) || base === quote)
    return Response.json({ error: "INVALID_CURRENCY_PAIR" }, { status: 400 });
  try {
    return Response.json(await getRateHistory(base, quote), {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return Response.json(
      { error: "HISTORY_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
