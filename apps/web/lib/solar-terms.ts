// The library numbers terms from Start of Spring (315°).
const names = [
  "立春",
  "雨水",
  "惊蛰",
  "春分",
  "清明",
  "谷雨",
  "立夏",
  "小满",
  "芒种",
  "夏至",
  "小暑",
  "大暑",
  "立秋",
  "处暑",
  "白露",
  "秋分",
  "寒露",
  "霜降",
  "立冬",
  "小雪",
  "大雪",
  "冬至",
  "小寒",
  "大寒",
] as const;

export type SolarTerm = {
  date: string;
  name: (typeof names)[number];
  longitude: number;
};

export async function loadSolarTerms(year: number): Promise<SolarTerm[]> {
  const { CalendarChinese } = await import("date-chinese");
  const calendar = new CalendarChinese();
  return names
    .map((name, index) => {
      const term = index + 1;
      // The two January terms fall in the following Gregorian year in this API.
      const jde = calendar.solarTerm(term, term >= 23 ? year - 1 : year);
      const gregorian = calendar.fromJDE(jde).toGregorian();
      return {
        date: `${gregorian.year}-${String(gregorian.month).padStart(2, "0")}-${String(gregorian.day).padStart(2, "0")}`,
        name,
        longitude: ((term + 20) % 24) * 15,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
