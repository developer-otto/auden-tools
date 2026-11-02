import { getLatestRates } from "../../../lib/server/rates";

export const runtime = "nodejs";
export async function GET() {
  try {
    return Response.json(await getLatestRates(), {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return Response.json(
      { error: "RATES_UNAVAILABLE" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "60" },
      },
    );
  }
}
