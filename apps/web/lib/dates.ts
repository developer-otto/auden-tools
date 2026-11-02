export function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("请选择有效日期。");
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (
    year < 1 ||
    year > 9999 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  )
    throw new Error("请选择有效日期。");
  return date;
}
export function daysBetween(start: string, end: string): number {
  return (parseDate(end).getTime() - parseDate(start).getTime()) / 86400000;
}
export function addDays(value: string, offset: string): string {
  if (!/^[+-]?\d{1,7}$/.test(offset.trim()))
    throw new Error("天数必须是有效整数。");
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + Number(offset));
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() < 1 ||
    date.getUTCFullYear() > 9999
  )
    throw new Error("计算结果超出支持的日期范围。");
  return date.toISOString().slice(0, 10);
}
