import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatCalendars,
  julianDate,
  romanDate,
} from "../lib/alternate-calendars.ts";
import { loadHolidays } from "../lib/calendar-holidays.ts";
import { zoneChanges, zoneOnDate } from "../lib/calendar-time.ts";

test("New York spring and fall changes include local times, abbreviations and offsets", () => {
  const [spring, fall] = zoneChanges("America/New_York", 2026);
  assert.equal(spring!.kind, "start");
  assert.equal(spring!.utc, "2026-03-08 07:00:00");
  assert.equal(spring!.wallBefore, "2026-03-08 02:00:00");
  assert.equal(spring!.wallAfter, "2026-03-08 03:00:00");
  assert.equal(spring!.before.abbreviation, "EST");
  assert.equal(spring!.after.abbreviation, "EDT");
  assert.equal(spring!.after.offset, "UTC-04:00");
  assert.equal(fall!.kind, "end");
  assert.equal(fall!.utc, "2026-11-01 06:00:00");
  assert.equal(fall!.wallAfter, "2026-11-01 01:00:00");
  assert.equal(fall!.after.offset, "UTC-05:00");
});

test("southern hemisphere and half-hour changes work without assuming the season order", () => {
  const [fall, spring] = zoneChanges("Australia/Lord_Howe", 2026);
  assert.equal(fall!.kind, "end");
  assert.equal(fall!.wallAfter, "2026-04-05 01:30:00");
  assert.equal(fall!.after.offset, "UTC+10:30");
  assert.equal(spring!.kind, "start");
  assert.equal(spring!.wallAfter, "2026-10-04 02:30:00");
  assert.equal(
    zoneOnDate("Australia/Sydney", new Date("2026-01-01")).season,
    "daylight",
  );
  assert.deepEqual(zoneChanges("Asia/Shanghai", 2026), []);
  assert.deepEqual(zoneChanges("America/Phoenix", 2026), []);
});

test("a one-off offset change is not marked as DST", () => {
  const [change] = zoneChanges("Europe/Moscow", 2014);
  assert.equal(change!.kind, "offset");
  assert.equal(change!.before.offset, "UTC+04:00");
  assert.equal(change!.after.offset, "UTC+03:00");
});

test("Gregorian dates map to Chinese New Year and Julian leap days", () => {
  const newYear = new Date("2026-02-17");
  assert.equal(
    new Map(formatCalendars(newYear, "zh-CN")).get("chinese"),
    "丙午年正月初一",
  );
  assert.deepEqual(julianDate(newYear), { year: 2026, month: 2, day: 4 });
  assert.deepEqual(julianDate(new Date("2100-03-14")), {
    year: 2100,
    month: 2,
    day: 29,
  });
  assert.equal(romanDate({ year: 2026, month: 3, day: 15 }), "Id. Mart.");
  assert.equal(
    romanDate({ year: 2024, month: 2, day: 25 }),
    "a.d. bis VI Kal. Mart.",
  );
});

test("holiday results preserve each region's civil date and observed days", async () => {
  const list = await loadHolidays(["CN", "JP", "US"], 2026, "zh-CN");
  assert.ok(
    list.some(
      (item) =>
        item.region === "CN" &&
        item.date === "2026-02-17" &&
        item.name === "春节",
    ),
  );
  assert.ok(
    list.some((item) => item.region === "JP" && item.date === "2026-02-11"),
  );
  assert.ok(
    list.some(
      (item) =>
        item.region === "US" && item.date === "2026-07-03" && item.substitute,
    ),
  );
});
