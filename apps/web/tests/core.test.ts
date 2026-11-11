import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as d from "../lib/decimal.ts";
import {
  cities,
  currencies,
  currencyDigits,
  timeZones,
} from "../lib/catalog.ts";
import { parseEpoch, parseLocal, formatLocal } from "../lib/time.ts";
import { formatJson } from "../lib/json.ts";
import { convertUnit } from "../lib/units.ts";
import { addDays, daysBetween } from "../lib/dates.ts";
import { isCurrencyCode, makeSnapshot, parseRateRows } from "../lib/rates.ts";

test("decimal ties round half up without binary-float errors", () => {
  assert.equal(d.round(d.add("0.1", "0.2"), 2), "0.30");
  assert.equal(d.round("1.005", 2), "1.01");
  assert.equal(d.round("2.675", 2), "2.68");
  assert.equal(d.round("-2.675", 2), "-2.68");
  assert.equal(d.round("-0.004", 2), "0.00");
  assert.equal(d.round("999.995", 2), "1000.00");
  assert.equal(d.convertAmount("2500", "1", "0.14017", 2), "350.43");
});
test("large amounts, scientific notation and repeating fractions retain precision", () => {
  assert.equal(d.round("9007199254740993.015", 2), "9007199254740993.02");
  assert.equal(
    d.format("9007199254740993.02", "en"),
    "9,007,199,254,740,993.02",
  );
  assert.equal(d.round(d.multiply(d.divide("1", "3"), "3"), 8), "1.00000000");
  assert.equal(d.round(d.divide("1", "3"), 8), "0.33333333");
  assert.equal(d.round("1.25e3", 2), "1250.00");
  assert.equal(d.round("5e-3", 2), "0.01");
});
test("empty, malformed, oversized and negative amounts fail explicitly", () => {
  for (const input of [
    "",
    "NaN",
    "Infinity",
    "1.2.3",
    "1,000",
    "1e101",
    "1e-101",
    "9".repeat(201),
  ])
    assert.throws(() => d.parse(input));
  assert.throws(() => d.divide("1", "0"));
  assert.throws(() => d.round("1", 101));
  assert.throws(() => d.convertAmount("-0.01", "1", "2", 2));
  assert.equal(d.convertAmount("0", "1", "2", 2), "0.00");
});
test("catalog includes 24 currencies without TWD and 25 unique IANA zones", () => {
  assert.equal(currencies.length, 24);
  assert.equal(new Set(currencies.map((currency) => currency.code)).size, 24);
  assert.equal(isCurrencyCode("TWD"), false);
  assert.equal(isCurrencyCode("MXN"), true);
  assert.equal(timeZones.length, 25);
  assert.equal(new Set(timeZones.map((zone) => zone.tz)).size, 25);
  for (const code of ["JPY", "KRW", "VND"]) {
    assert.equal(currencyDigits(code), 0);
    assert.equal(
      d.convertAmount("123.5", "1", "1", currencyDigits(code)),
      "124",
    );
  }
});
test("upstream decimals survive parsing and cross-rates round only at the end", () => {
  const body =
    '[{"date":"2026-10-30","base":"CNY","quote":"USD","rate":0.1234567890123456789}]';
  assert.equal(parseRateRows(body, "CNY")[0]!.rate, "0.1234567890123456789");
  const rows = parseRateRows(
    readFileSync(new URL("./fixtures/rates.json", import.meta.url), "utf8"),
    "CNY",
  );
  const snapshot = makeSnapshot(rows, "2026-10-31T09:00:00Z");
  assert.equal(Object.keys(snapshot.rates).length, 24);
  assert.equal(snapshot.rates.MXN!.date, "2026-10-30");
  assert.equal(snapshot.rates.CNY!.rate, "1");
  for (const from of Object.values(snapshot.rates))
    for (const to of Object.values(snapshot.rates)) {
      const converted = d.multiply(
        "123456789012345.6789",
        d.divide(to.rate, from.rate),
      );
      const restored = d.multiply(converted, d.divide(from.rate, to.rate));
      assert.equal(d.round(restored, 4), "123456789012345.6789");
    }
});
test("invalid provider records cannot silently become live rates", () => {
  for (const body of [
    "{}",
    "null",
    "[{}]",
    '[{"base":"CNY","quote":"USD","date":"2026-02-30","rate":1}]',
    '[{"base":"CNY","quote":"USD","date":"2026-10-30","rate":-1}]',
    '[{"base":"CNY","quote":"TWD","date":"2026-10-30","rate":1}]',
  ])
    assert.throws(() => parseRateRows(body, "CNY"));
  assert.throws(() => makeSnapshot([], "2026-10-31T00:00:00Z"));
});
test("unit conversion uses exact factors and temperature offsets", () => {
  assert.equal(convertUnit("1", "length", "in", "m"), "0.02540000");
  assert.equal(convertUnit("1", "weight", "lb", "kg"), "0.45359237");
  assert.equal(convertUnit("98.6", "temperature", "f", "c"), "37.00000000");
  assert.equal(convertUnit("273.15", "temperature", "k", "c"), "0.00000000");
  assert.equal(convertUnit("-40", "temperature", "c", "f"), "-40.00000000");
  assert.throws(() => convertUnit("", "length", "m", "km"));
});
test("all 25 time zones round-trip milliseconds in winter and summer", () => {
  for (const instant of [
    "2026-01-15T12:34:56.007Z",
    "2026-07-15T12:34:56.999Z",
  ]) {
    const date = new Date(instant);
    for (const zone of timeZones)
      assert.ok(
        parseLocal(formatLocal(date, zone.tz, true), zone.tz).some(
          (candidate) => candidate.getTime() === date.getTime(),
        ),
        zone.tz,
      );
  }
  assert.equal(
    formatLocal(new Date("2026-07-15T12:34:56Z"), "Asia/Kolkata"),
    "2026-07-15T18:04:56",
  );
});
test("DST gaps fail and overlaps return both distinct instants", () => {
  const candidates = parseLocal("2024-11-03T01:30:00", "America/New_York");
  assert.equal(candidates.length, 2);
  assert.equal(candidates[1]!.getTime() - candidates[0]!.getTime(), 3600000);
  assert.equal(parseLocal("2024-10-27T01:30", "Europe/London").length, 2);
  assert.throws(() => parseLocal("2024-03-10T02:30", "America/New_York"));
  assert.throws(() => parseLocal("2026-02-30T12:00", "UTC"));
});
test("epoch conversion preserves milliseconds and checks safe/range boundaries", () => {
  assert.equal(
    parseEpoch("-1", "milliseconds").toISOString(),
    "1969-12-31T23:59:59.999Z",
  );
  assert.equal(
    parseEpoch("1793438936007", "milliseconds").getUTCMilliseconds(),
    7,
  );
  assert.throws(() => parseEpoch("9007199254740992", "milliseconds"));
  assert.throws(() => parseEpoch("8640000000000001", "milliseconds"));
  assert.throws(() => parseEpoch("123.5", "seconds"));
  assert.equal(
    parseLocal("0001-01-01T00:00:01", "UTC")[0]!.toISOString(),
    "0001-01-01T00:00:01.000Z",
  );
  assert.equal(
    formatLocal(new Date("-000001-01-01T00:00:00Z"), "UTC"),
    "-000001-01-01T00:00:00",
  );
});
test("date arithmetic handles leap days, reverse ranges and invalid inputs", () => {
  assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2);
  assert.equal(daysBetween("2024-03-01", "2024-02-28"), -2);
  assert.equal(addDays("2024-03-01", "-1"), "2024-02-29");
  assert.equal(addDays("0001-01-01", "1"), "0001-01-02");
  assert.throws(() => addDays("2026-02-30", "1"));
  assert.throws(() => addDays("9999-12-31", "1"));
  assert.throws(() => addDays("2026-01-01", "1.5"));
});
test("JSON formatting preserves exact numbers, escapes, duplicate keys and negative zero", () => {
  const source =
    '{"id":9007199254740993,"amount":1.00000000000000000001,"huge":1e400,"zero":-0,"name":"金额 \\u4e2d","empty":[],"nested":[{},true,null]}';
  const formatted = formatJson(source, 4);
  assert.ok(formatted.includes('\n    "id": 9007199254740993,'));
  assert.ok(formatted.includes("1.00000000000000000001"));
  assert.equal(formatJson(formatted, 0), source);
  assert.equal(formatJson(' { "a": 1, "a": 2 } ', 0), '{"a":1,"a":2}');
  assert.throws(() => formatJson('{"a":1,}'));
});
test("all UI/catalog translations cover five languages with matching placeholders", () => {
  const messages = Object.assign(
    {},
    ...[
      "messages",
      "conversion-messages",
      "calendar-messages",
      "market-messages",
    ].map((name) =>
      JSON.parse(
        readFileSync(new URL(`../lib/${name}.json`, import.meta.url), "utf8"),
      ),
    ),
  ) as Record<string, string[]>;
  const placeholders = (text: string) =>
    [...text.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
  for (const [key, row] of Object.entries(messages)) {
    assert.equal(row.length, 5, key);
    row.forEach((text) => {
      assert.ok(text);
      assert.deepEqual(placeholders(text), placeholders(key), key);
    });
  }
  for (const item of [...currencies, ...cities])
    for (const key of [item.name, item.country, item.region])
      assert.ok(messages[key], key);
});
