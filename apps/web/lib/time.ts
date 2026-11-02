type TimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  era: string;
};
const formatters = new Map<string, Intl.DateTimeFormat>();
export function dateParts(date: Date, timeZone: string): TimeParts {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      era: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  const result = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  ) as TimeParts;
  if (result.era === "BC") result.year = String(1 - Number(result.year));
  return result;
}
export function formatLocal(
  date: Date,
  timeZone = "Asia/Shanghai",
  milliseconds = false,
): string {
  const p = dateParts(date, timeZone),
    year = Number(p.year);
  const yearText =
    year >= 0 && year <= 9999
      ? p.year.padStart(4, "0")
      : `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(6, "0")}`;
  return `${yearText}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${milliseconds ? "." + String(date.getUTCMilliseconds()).padStart(3, "0") : ""}`;
}
function utcValue(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date;
}
export function parseLocal(value: string, timeZone: string): Date[] {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
      value,
    );
  if (!match) throw new Error("请输入完整的日期和时间。");
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map((value) => Number(value || 0)) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const milliseconds = Number((match[7] || "").padEnd(3, "0"));
  const wall = utcValue(year, month, day, hour, minute, second);
  if (
    year < 1 ||
    wall.getUTCFullYear() !== year ||
    wall.getUTCMonth() + 1 !== month ||
    wall.getUTCDate() !== day ||
    wall.getUTCHours() !== hour ||
    wall.getUTCMinutes() !== minute ||
    wall.getUTCSeconds() !== second
  )
    throw new Error("日期或时间无效，请检查输入。");
  const expected = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || "00"}`;
  const offsets = new Set<number>();
  for (let delta = -36; delta <= 36; delta += 6) {
    const probe = new Date(wall.getTime() + delta * 3600000),
      p = dateParts(probe, timeZone);
    offsets.add(
      utcValue(
        Number(p.year),
        Number(p.month),
        Number(p.day),
        Number(p.hour),
        Number(p.minute),
        Number(p.second),
      ).getTime() - probe.getTime(),
    );
  }
  const candidates = [...offsets]
    .map((offset) => new Date(wall.getTime() - offset))
    .filter((date) => formatLocal(date, timeZone) === expected)
    .sort((a, b) => a.getTime() - b.getTime());
  if (!candidates.length)
    throw new Error(
      "该时区在此刻发生时钟跳转，这个当地时间不存在。请调整时间。",
    );
  return candidates.map((date) => new Date(date.getTime() + milliseconds));
}
export function parseEpoch(
  value: string,
  unit: "seconds" | "milliseconds",
): Date {
  if (!/^-?\d{1,18}$/.test(value.trim()))
    throw new Error("请输入有效的整数时间戳。");
  const milliseconds = BigInt(value.trim()) * (unit === "seconds" ? 1000n : 1n);
  if (
    milliseconds > BigInt(Number.MAX_SAFE_INTEGER) ||
    milliseconds < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error("时间戳超出安全转换范围。");
  const date = new Date(Number(milliseconds));
  if (!Number.isFinite(date.getTime()))
    throw new Error("这个时间超出了有效范围，请检查输入。");
  return date;
}
export function offsetLabel(tz: string, date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((item) => item.type === "timeZoneName")!
    .value.replace("GMT", "UTC");
}
export function timeIn(
  tz: string,
  date: Date,
  locale: string,
  hour12 = false,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: hour12 ? "h12" : "h23",
  }).format(date);
}
