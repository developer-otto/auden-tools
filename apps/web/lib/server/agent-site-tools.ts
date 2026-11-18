import { tool } from "@openai/agents";
import { z } from "zod";
import { currencies, currencyDigits } from "../catalog.ts";
import { addDays, daysBetween } from "../dates.ts";
import { convertAmount, divide, parse, round } from "../decimal.ts";
import { formatLocal, offsetLabel, parseLocal } from "../time.ts";
import { convertUnit, unitGroups, type UnitGroup } from "../units.ts";
import { getLatestRates } from "./rates.ts";

const currencyCode = z.enum(currencies.map(({ code }) => code));
const unitKinds: UnitGroup[] = ["length", "weight", "temperature"];
const unitCode = z.enum(
  unitKinds.flatMap((kind) => unitGroups[kind].units.map(({ id }) => id)),
);

export function createSiteTools(
  signal: AbortSignal,
  { discovery = false, programmatic = false } = {},
) {
  const options = {
    deferLoading: discovery,
    ...(programmatic
      ? {
          allowedCallers: ["direct", "programmatic"] as const,
        }
      : {}),
  };
  // All conversions in one reply share the same published rate snapshot.
  let rates: ReturnType<typeof getLatestRates> | undefined;
  return [
    tool({
      ...options,
      name: "date_add_days",
      description: "Add or subtract calendar days on the Gregorian calendar.",
      parameters: z.object({
        date: z.string().describe("Calendar date in YYYY-MM-DD format"),
        days: z.number().int().describe("Signed number of calendar days"),
      }),
      execute({ date, days }) {
        try {
          return { date: addDays(date, String(days)) };
        } catch {
          return {
            error:
              "Invalid date, day count, or resulting date outside years 1–9999.",
          };
        }
      },
    }),
    tool({
      ...options,
      name: "date_days_between",
      description:
        "Calculate end minus start in Gregorian calendar days, excluding the start day.",
      parameters: z.object({
        start: z.string().describe("Start date in YYYY-MM-DD format"),
        end: z.string().describe("End date in YYYY-MM-DD format"),
      }),
      execute({ start, end }) {
        try {
          return { days: daysBetween(start, end) };
        } catch {
          return { error: "Use valid Gregorian dates in YYYY-MM-DD format." };
        }
      },
    }),
    tool({
      ...options,
      name: "convert_time_zone",
      description:
        "Convert a local date and time between IANA time zones. Handles daylight saving gaps and overlaps.",
      parameters: z.object({
        local: z
          .string()
          .describe(
            "Local date and time without an offset, e.g. 2026-08-12T09:00",
          ),
        from: z
          .string()
          .describe("Source IANA time zone, e.g. America/New_York"),
        to: z
          .string()
          .describe("Destination IANA time zone, e.g. Asia/Shanghai"),
      }),
      execute({ local, from, to }) {
        if (local.length > 23 || from.length > 64 || to.length > 64)
          return {
            error:
              "Use a local date and time and valid IANA time zone identifiers.",
          };
        try {
          const sourceZone = new Intl.DateTimeFormat("en", {
            timeZone: from,
          }).resolvedOptions().timeZone;
          const targetZone = new Intl.DateTimeFormat("en", {
            timeZone: to,
          }).resolvedOptions().timeZone;
          const instants = parseLocal(local, sourceZone);
          return {
            from,
            to,
            ambiguous: instants.length > 1,
            candidates: instants.map((instant) => ({
              utc: instant.toISOString(),
              local: formatLocal(instant, targetZone, local.includes(".")),
              sourceOffset: offsetLabel(sourceZone, instant),
              targetOffset: offsetLabel(targetZone, instant),
            })),
          };
        } catch (error) {
          return {
            error:
              error instanceof RangeError
                ? "Invalid time zone identifier. Use IANA time zone names."
                : error instanceof Error
                  ? error.message
                  : "Invalid local date and time.",
          };
        }
      },
    }),
    tool({
      ...options,
      name: "convert_unit",
      description:
        "Convert a measurement within length, weight, or temperature. Use c, f, and k for temperature.",
      parameters: z.object({
        amount: z
          .string()
          .describe("Decimal amount without a unit or grouping separators"),
        from: unitCode,
        to: unitCode,
      }),
      execute({ amount, from, to }) {
        const kind = unitKinds.find((item) => {
          const units = unitGroups[item].units;
          return (
            units.some(({ id }) => id === from) &&
            units.some(({ id }) => id === to)
          );
        });
        if (!kind)
          return {
            error:
              "Source and destination units must measure the same quantity.",
          };
        try {
          return { value: convertUnit(amount, kind, from, to), unit: to };
        } catch {
          return { error: "Use a supported decimal amount and unit pair." };
        }
      },
    }),
    tool({
      ...options,
      name: "convert_currency",
      description:
        "Convert supported currencies using the latest published Frankfurter reference rates. These are dated reference rates.",
      parameters: z.object({
        amount: z
          .string()
          .describe(
            "Nonnegative decimal amount. Use 1 when asked for an exchange rate.",
          ),
        from: currencyCode,
        to: currencyCode,
      }),
      async execute({ amount, from, to }) {
        try {
          if (parse(amount).n < 0n)
            return { error: "Currency amounts must be nonnegative." };
        } catch {
          return { error: "Use a valid nonnegative decimal amount." };
        }
        if (from === to) {
          return {
            value: round(amount, currencyDigits(to)),
            currency: to,
            rate: "1",
          };
        }
        const snapshot = await (rates ??= getLatestRates(signal)).catch(
          () => null,
        );
        if (!snapshot)
          return { error: "The reference rate provider is unavailable." };
        const base = snapshot.rates[from];
        const quote = snapshot.rates[to];
        if (!base || !quote)
          return {
            error: "A reference rate is unavailable for this currency pair.",
          };
        return {
          value: convertAmount(
            amount,
            base.rate,
            quote.rate,
            currencyDigits(to),
          ),
          currency: to,
          rate: round(divide(quote.rate, base.rate), 10),
          rateDates: {
            [from]: from === snapshot.base ? undefined : base.date,
            [to]: to === snapshot.base ? undefined : quote.date,
          },
          source: snapshot.source,
          sourceUrl: snapshot.sourceUrl,
        };
      },
    }),
  ];
}
