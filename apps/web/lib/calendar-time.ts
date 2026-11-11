const daySeconds = 86_400;

type Season = "standard" | "daylight" | "other";
export type ZoneReading = {
  offset: string;
  abbreviation: string;
  name: string;
  season: Season;
};
export type ZoneChange = {
  utc: string;
  date: string;
  wallBefore: string;
  wallAfter: string;
  before: ZoneReading;
  after: ZoneReading;
  kind: "start" | "end" | "offset";
};

function zoneFormatter(
  zone: string,
  style: "long" | "short" | "longOffset",
  locale = "en-US",
) {
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    timeZoneName: style,
  });
  return (seconds: number) =>
    formatter
      .formatToParts(seconds * 1000)
      .find((part) => part.type === "timeZoneName")!.value;
}

function readOffset(offset: (seconds: number) => string, seconds: number) {
  const value = offset(seconds);
  if (value === "GMT") return 0;
  const match = /^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new RangeError("Unsupported UTC offset");
  return (
    (match[1] === "-" ? -1 : 1) *
    (Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] ?? 0))
  );
}

function wallTime(seconds: number, offset = 0) {
  return new Date((seconds + offset) * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function zoneReader(zone: string) {
  const offset = zoneFormatter(zone, "longOffset");
  const short = zoneFormatter(
    zone,
    "short",
    zone.startsWith("Europe/")
      ? "en-GB"
      : /^(Australia|Pacific)\//.test(zone)
        ? "en-AU"
        : "en-US",
  );
  const long = zoneFormatter(zone, "long");
  return {
    offset: (seconds: number) => readOffset(offset, seconds),
    reading(seconds: number): ZoneReading {
      const name = long(seconds);
      return {
        offset: offset(seconds)
          .replace(/^GMT$/, "UTC+00:00")
          .replace(/^GMT/, "UTC"),
        abbreviation: short(seconds),
        name,
        season: /\b(Daylight|Summer)\b/.test(name)
          ? "daylight"
          : /\bStandard\b/.test(name) || name === "Greenwich Mean Time"
            ? "standard"
            : "other",
      };
    },
  };
}

export function zoneOnDate(zone: string, date: Date): ZoneReading {
  const reader = zoneReader(zone);
  const noon = date.getTime() / 1000 + 43_200;
  const guess = noon - reader.offset(noon);
  return reader.reading(noon - reader.offset(guess));
}

export function zoneChanges(zone: string, year: number): ZoneChange[] {
  const reader = zoneReader(zone);
  const start = Date.UTC(year, 0, 1) / 1000 - daySeconds;
  const end = Date.UTC(year + 1, 0, 1) / 1000 + daySeconds;
  const changes: ZoneChange[] = [];
  let previous = reader.offset(start);
  // Scan the browser's tz data, then bisect changed days to the transition second.
  for (let upper = start + daySeconds; upper <= end; upper += daySeconds) {
    const next = reader.offset(upper);
    if (previous === next) continue;
    let low = upper - daySeconds;
    let high = upper;
    while (high - low > 1) {
      const middle = Math.floor((high + low) / 2);
      if (reader.offset(middle) === previous) low = middle;
      else high = middle;
    }
    const beforeOffset = previous;
    previous = next;
    const wallBefore = wallTime(high, beforeOffset);
    const wallAfter = wallTime(high, reader.offset(high));
    // Use the scheduled local date even if a midnight rollback goes into the previous day.
    const date = wallBefore.slice(0, 10);
    if (!date.startsWith(`${year}-`)) continue;
    const before = reader.reading(high - 1);
    const after = reader.reading(high);
    changes.push({
      utc: wallTime(high),
      date,
      wallBefore,
      wallAfter,
      before,
      after,
      kind:
        before.season !== "daylight" && after.season === "daylight"
          ? "start"
          : before.season === "daylight" && after.season !== "daylight"
            ? "end"
            : "offset",
    });
  }
  return changes;
}
