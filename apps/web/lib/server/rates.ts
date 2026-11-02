import { currencies } from "../catalog";
import {
  isCurrencyCode,
  makeSnapshot,
  parseRateRows,
  type RateHistory,
} from "../rates";

const API = "https://api.frankfurter.dev/v2/rates";
async function requestRates(params: URLSearchParams, base: string) {
  const response = await fetch(`${API}?${params}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Rate provider unavailable");
  return parseRateRows(await response.text(), base);
}
export async function getLatestRates() {
  const rows = await requestRates(
    new URLSearchParams({
      base: "CNY",
      quotes: currencies
        .filter((currency) => currency.code !== "CNY")
        .map((currency) => currency.code)
        .join(","),
    }),
    "CNY",
  );
  return makeSnapshot(rows, new Date().toISOString());
}
export async function getRateHistory(
  base: string,
  quote: string,
): Promise<RateHistory> {
  if (!isCurrencyCode(base) || !isCurrencyCode(quote) || base === quote)
    throw new Error("Invalid currency pair");
  const end = new Date(),
    start = new Date(end.getTime() - 30 * 86400000);
  const rows = await requestRates(
    new URLSearchParams({
      base,
      quotes: quote,
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    }),
    base,
  );
  const points = rows
    .filter((row) => row.quote === quote)
    .map(({ date, rate }) => ({ date, rate }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { base, quote, points, source: "Frankfurter" };
}
