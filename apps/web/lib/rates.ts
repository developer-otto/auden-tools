import { currencies } from "./catalog.ts";
import { parse } from "./decimal.ts";

export type RateRow = {
  date: string;
  base: string;
  quote: string;
  rate: string;
};
export type RatesSnapshot = {
  base: "CNY";
  rates: Record<string, { rate: string; date: string }>;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
};
export type RateHistory = {
  base: string;
  quote: string;
  points: { date: string; rate: string }[];
  source: string;
};
const codes = new Set(currencies.map((currency) => currency.code));
export const isCurrencyCode = (value: string): boolean => codes.has(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Node 24's JSON reviver source preserves the upstream decimal token before Number rounding. */
export function parseRateRows(body: string, base: string): RateRow[] {
  if (body.length > 1_000_000) throw new Error("Rate response too large");
  const data: unknown = JSON.parse(
    body,
    (key: string, value: unknown, context?: { source?: string }) => {
      if (key === "rate" && typeof value === "number") {
        if (!context?.source)
          throw new Error("Lossless JSON parsing requires Node 24");
        return context.source;
      }
      return value;
    },
  );
  if (!Array.isArray(data) || data.length > 5000)
    throw new Error("Invalid rate response");
  return data.map((item: unknown) => {
    if (
      !isRecord(item) ||
      item.base !== base ||
      typeof item.quote !== "string" ||
      !codes.has(item.quote) ||
      typeof item.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
      typeof item.rate !== "string" ||
      item.rate.length > 64
    )
      throw new Error("Invalid rate row");
    const date = new Date(`${item.date}T00:00:00Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== item.date ||
      parse(item.rate).n <= 0n
    )
      throw new Error("Invalid rate value");
    return { date: item.date, base, quote: item.quote, rate: item.rate };
  });
}

export function makeSnapshot(
  rows: RateRow[],
  fetchedAt: string,
): RatesSnapshot {
  if (!rows.length) throw new Error("No rates available");
  const dates = rows.map((row) => row.date).sort();
  const rates: RatesSnapshot["rates"] = {
    CNY: { rate: "1", date: dates.at(-1)! },
  };
  for (const row of rows) {
    if (!rates[row.quote] || rates[row.quote]!.date < row.date)
      rates[row.quote] = { rate: row.rate, date: row.date };
  }
  return {
    base: "CNY",
    rates,
    source: "Frankfurter",
    sourceUrl: "https://frankfurter.dev/",
    fetchedAt,
  };
}
