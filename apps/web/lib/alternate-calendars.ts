const calendars = [
  "chinese",
  "japanese",
  "buddhist",
  "islamic-civil",
  "hebrew",
  "persian",
] as const;

const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

function chineseLunarLabel(formatter: Intl.DateTimeFormat, date: Date) {
  const parts = formatter.formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  const day = Number(part("day"));
  const year = part("yearName");
  const month = part("month");
  if (!year || !month || !Number.isInteger(day) || day < 1 || day > 30)
    return formatter.format(date);
  const label =
    day <= 10
      ? `初${digits[day]}`
      : day < 20
        ? `十${digits[day - 10]}`
        : day === 20
          ? "二十"
          : day < 30
            ? `廿${digits[day - 20]}`
            : "三十";
  return `${year}年${month}${label}`;
}

export function formatCalendars(date: Date, locale: string) {
  return calendars.map((calendar) => {
    const formatter = new Intl.DateTimeFormat(locale, {
      calendar,
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
      ...(calendar === "japanese" ? { era: "short" } : {}),
    });
    return [
      calendar,
      formatter.resolvedOptions().calendar === calendar
        ? calendar === "chinese" && locale.startsWith("zh")
          ? chineseLunarLabel(formatter, date)
          : formatter.format(date)
        : "—",
    ] as const;
  });
}

// Convert via the integer Julian day number at noon for a Gregorian civil date.
export function julianDate(date: Date) {
  const jdn = Math.floor(date.getTime() / 86_400_000) + 2_440_588;
  const c = jdn + 32_082;
  const d = Math.floor((4 * c + 3) / 1_461);
  const e = c - Math.floor((1_461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    year: d - 4_800 + Math.floor(m / 10),
    month: m + 3 - 12 * Math.floor(m / 10),
    day: e - Math.floor((153 * m + 2) / 5) + 1,
  };
}

const monthNames = [
  "Ian.",
  "Feb.",
  "Mart.",
  "Apr.",
  "Mai.",
  "Iun.",
  "Iul.",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
];
const numerals = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
];

export function romanDate({ year, month, day }: ReturnType<typeof julianDate>) {
  const longMonth = [3, 5, 7, 10].includes(month);
  const nones = longMonth ? 7 : 5;
  const ides = longMonth ? 15 : 13;
  const leap = month === 2 && year % 4 === 0;
  const days =
    month === 2 ? 28 + Number(leap) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  const target =
    day === 1 ? "Kal." : day <= nones ? "Non." : day <= ides ? "Id." : "Kal.";
  const targetMonth = day > ides ? month % 12 : month - 1;
  // Roman leap years repeated the sixth day before the Kalends of March.
  if (leap && day === 25) return "a.d. bis VI Kal. Mart.";
  const count =
    day === 1
      ? 1
      : day <= nones
        ? nones - day + 1
        : day <= ides
          ? ides - day + 1
          : days + 2 - day - Number(leap && day <= 24);
  const prefix =
    count === 1 ? "" : count === 2 ? "pridie " : `a.d. ${numerals[count]} `;
  return `${prefix}${target} ${monthNames[targetMonth]}`;
}
