import calendarDictionary from "./calendar-messages.json";
import marketDictionary from "./market-messages.json";
import dictionary from "./messages.json";
import conversionDictionary from "./conversion-messages.json";

export const locales = ["zh-CN", "zh-Hant", "en", "ja", "ko"] as const;
export type Locale = (typeof locales)[number];
export const languageNames: Record<Locale, string> = {
  "zh-CN": "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
};
export const messages: Record<string, string[]> = {
  ...dictionary,
  ...conversionDictionary,
  ...calendarDictionary,
  ...marketDictionary,
};
export function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}
export function translate(
  locale: Locale,
  key: string,
  values: Record<string, string | number> = {},
): string {
  const message = messages[key]?.[locales.indexOf(locale)] ?? key;
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    String(values[name] ?? placeholder),
  );
}
export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;
export function matchesQuery(query: string, ...terms: (string | undefined)[]) {
  const search = terms
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => messages[value] || [value])
    .join(" ");
  const normalize = (value: string) =>
    value.normalize("NFKC").toLowerCase().replaceAll("_", " ").trim();
  return normalize(search).includes(normalize(query));
}
