export const holidayRegions = [
  "CN",
  "HK",
  "TW",
  "US",
  "CA",
  "GB",
  "FR",
  "DE",
  "IT",
  "JP",
  "KR",
  "AU",
  "NZ",
  "SG",
  "IN",
  "BR",
] as const;
export type HolidayRegion = (typeof holidayRegions)[number];
export type CalendarHoliday = {
  region: HolidayRegion;
  date: string;
  name: string;
  substitute: boolean;
};

export async function loadHolidays(
  regions: readonly HolidayRegion[],
  year: number,
  locale: string,
): Promise<CalendarHoliday[]> {
  if (!regions.length) return [];
  const { default: Holidays } = await import("date-holidays");
  const language = locale.split("-")[0];
  const results = new Map<string, CalendarHoliday>();
  for (const region of regions) {
    const source = new Holidays(region, { types: ["public"] });
    for (const holiday of source.getHolidays(year, language)) {
      if (holiday.type !== "public") continue;
      const start = holiday.date.slice(0, 10);
      const count = Math.max(
        1,
        Math.round(
          (holiday.end.getTime() - holiday.start.getTime()) / 86_400_000,
        ),
      );
      const first = Date.parse(start);
      for (let index = 0; index < count; index++) {
        const date = new Date(first + index * 86_400_000)
          .toISOString()
          .slice(0, 10);
        if (!date.startsWith(`${year}-`)) continue;
        const item = {
          date,
          region,
          name: holiday.name,
          substitute: Boolean(holiday.substitute),
        };
        results.set(`${date}|${region}|${item.name}`, item);
      }
    }
  }
  return [...results.values()].sort((a, b) => a.date.localeCompare(b.date));
}
