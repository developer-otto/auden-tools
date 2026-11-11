"use client";

import { memo, useEffect, useId, useMemo, useState } from "react";
import { labelDayButton } from "react-day-picker";
import {
  formatCalendars,
  julianDate,
  romanDate,
} from "../../lib/alternate-calendars";
import {
  holidayRegions,
  loadHolidays,
  type CalendarHoliday,
  type HolidayRegion,
} from "../../lib/calendar-holidays";
import {
  zoneChanges,
  zoneOnDate,
  type ZoneReading,
} from "../../lib/calendar-time";
import { timeZones } from "../../lib/catalog";
import { parseDate } from "../../lib/dates";
import { useApp } from "../providers";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Calendar, calendarLocales } from "../ui/calendar";
import { Card } from "../ui/card";
import { Select, SelectItem } from "../ui/select";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle";

const first = parseDate("1970-01-01");
const last = parseDate("2100-12-31");
const years = Array.from({ length: 131 }, (_, index) => 1970 + index);
const months = Array.from(
  { length: 12 },
  (_, index) => new Date(Date.UTC(2020, index, 1)),
);
const calendarNames = {
  chinese: "中国农历",
  japanese: "日本年号",
  buddhist: "佛历",
  "islamic-civil": "伊斯兰历（民用）",
  hebrew: "希伯来历",
  persian: "波斯历",
};
const seasonNames = {
  standard: "标准时间（冬令时）",
  daylight: "夏令时",
  other: "当地时间",
};
const changeNames = {
  start: "进入夏令时",
  end: "结束夏令时",
  offset: "UTC 偏移变更",
};
const calendarZones = [
  ...timeZones,
  { id: "lord-howe", name: "豪勋爵岛", flag: "🇦🇺", tz: "Australia/Lord_Howe" },
  { id: "phoenix", name: "菲尼克斯", flag: "🇺🇸", tz: "America/Phoenix" },
];
const defaultRegions: HolidayRegion[] = ["CN", "US", "JP"];
const dateKey = (date: Date) => date.toISOString().slice(0, 10);

function ZoneInfo({ reading }: { reading: ZoneReading }) {
  const { t } = useApp();
  return (
    <span className="calendar-zone-info">
      <Badge className={`calendar-tag calendar-${reading.season}`}>
        {t(seasonNames[reading.season])}
      </Badge>
      <span>
        {/^GMT[+-]/.test(reading.abbreviation)
          ? reading.name
          : reading.abbreviation}{" "}
        · {reading.offset}
      </span>
    </span>
  );
}

export const CalendarExplorer = memo(function CalendarExplorer({
  today,
}: {
  today: string;
}) {
  const { locale, t } = useApp();
  const id = useId();
  const [selected, setSelected] = useState(() => parseDate(today));
  const [zone, setZone] = useState("Asia/Shanghai");
  const [regions, setRegions] = useState<HolidayRegion[]>(defaultRegions);
  const [holidays, setHolidays] = useState<{
    key: string;
    items: CalendarHoliday[] | null;
  }>();
  const year = selected.getUTCFullYear();
  const month = selected.getUTCMonth();
  const key = dateKey(selected);
  const todayDate = useMemo(() => parseDate(today), [today]);
  const visibleMonth = useMemo(
    () => new Date(Date.UTC(year, month, 1)),
    [year, month],
  );
  const requestKey = `${year}|${locale}|${regions.join(",")}`;
  useEffect(() => {
    if (!regions.length) return;
    let canceled = false;
    loadHolidays(regions, year, locale)
      .then((items) => {
        if (!canceled) setHolidays({ key: requestKey, items });
      })
      .catch(() => {
        if (!canceled) setHolidays({ key: requestKey, items: null });
      });
    return () => {
      canceled = true;
    };
  }, [year, locale, regions, requestKey]);

  const available = holidays?.key === requestKey ? holidays.items : undefined;
  const monthKey = key.slice(0, 7);
  const monthHolidays = useMemo(
    () =>
      (available ?? []).filter((holiday) => holiday.date.startsWith(monthKey)),
    [available, monthKey],
  );
  const holidayDates = useMemo(
    () => [...new Set(monthHolidays.map((item) => item.date))].map(parseDate),
    [monthHolidays],
  );
  const changes = useMemo(() => zoneChanges(zone, year), [zone, year]);
  const changeDates = useMemo(
    () => changes.map((change) => parseDate(change.date)),
    [changes],
  );
  const dateHolidays = monthHolidays.filter((holiday) => holiday.date === key);
  const dateChanges = changes.filter((change) => change.date === key);
  const regionNames = useMemo(
    () => new Intl.DisplayNames(locale, { type: "region" }),
    [locale],
  );
  const monthNames = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }),
    [locale],
  );
  const fullDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }),
    [locale],
  );
  const otherDates = useMemo(
    () => formatCalendars(selected, locale),
    [selected, locale],
  );
  const reading = useMemo(() => zoneOnDate(zone, selected), [zone, selected]);
  const julian = julianDate(selected);

  const setMonth = (nextYear: number, nextMonth: number) => {
    const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
    setSelected(
      new Date(
        Date.UTC(nextYear, nextMonth, Math.min(lastDay, selected.getUTCDate())),
      ),
    );
  };

  return (
    <div className="calendar-explorer">
      <div className="calendar-overview">
        <Card as="section" className="panel calendar-month">
          <div className="panel-heading">
            <h2>{t("日历表")}</h2>
            <Button
              className="button small"
              onClick={() => setSelected(todayDate)}
            >
              {t("回到今天")}
            </Button>
          </div>
          <div className="calendar-controls">
            <Select
              className="field"
              aria-label={t("年份")}
              value={year}
              onValueChange={(value) => setMonth(Number(value), month)}
            >
              {years.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </Select>
            <Select
              className="field"
              aria-label={t("月份")}
              value={month}
              onValueChange={(value) => setMonth(year, Number(value))}
            >
              {months.map((item, index) => (
                <SelectItem key={index} value={index}>
                  {monthNames.format(item)}
                </SelectItem>
              ))}
            </Select>
          </div>
          <Calendar
            className="ui-calendar explorer-calendar"
            mode="single"
            required
            selected={selected}
            today={todayDate}
            month={visibleMonth}
            onMonthChange={(date) =>
              setMonth(date.getUTCFullYear(), date.getUTCMonth())
            }
            onSelect={setSelected}
            locale={calendarLocales[locale]}
            timeZone="UTC"
            startMonth={first}
            endMonth={last}
            showOutsideDays={false}
            fixedWeeks
            modifiers={{ holiday: holidayDates, zoneChange: changeDates }}
            modifiersClassNames={{
              holiday: "calendar-holiday",
              zoneChange: "calendar-zone-change",
            }}
            labels={{
              labelDayButton: (day, modifiers, options) =>
                [
                  labelDayButton(day, modifiers, options),
                  modifiers.holiday ? t("公共节日") : "",
                  modifiers.zoneChange ? t("时钟切换") : "",
                ]
                  .filter(Boolean)
                  .join(" · "),
            }}
          />
          <div className="calendar-legend">
            <span>
              <i className="calendar-dot holiday-dot" />
              {t("公共节日")}
            </span>
            <span>
              <i className="calendar-dot zone-dot" />
              {t("时钟切换")}
            </span>
          </div>
        </Card>

        <Card as="section" className="panel calendar-day-detail">
          <div className="panel-heading">
            <h2>{t("当日详情")}</h2>
          </div>
          <p className="calendar-selected-date">{fullDate.format(selected)}</p>
          <dl className="calendar-date-list">
            {otherDates.map(([calendar, label]) => (
              <div key={calendar}>
                <dt>{t(calendarNames[calendar])}</dt>
                <dd>{label}</dd>
              </div>
            ))}
            <div>
              <dt>{t("儒略历")}</dt>
              <dd>
                {[julian.year, julian.month, julian.day]
                  .map((part) => String(part).padStart(2, "0"))
                  .join("-")}
              </dd>
            </div>
            <div>
              <dt>{t("古罗马纪日法")}</dt>
              <dd lang="la">{romanDate(julian)}</dd>
            </div>
          </dl>
          <h3>{t("当日公共节日")}</h3>
          {dateHolidays.length ? (
            <ul className="calendar-holidays">
              {dateHolidays.map((holiday) => (
                <li key={`${holiday.region}|${holiday.name}`}>
                  <Badge className="calendar-tag">
                    {regionNames.of(holiday.region)}
                  </Badge>{" "}
                  {holiday.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted calendar-note">
              {t(
                !regions.length
                  ? "请选择节日地区。"
                  : available === null
                    ? "节日数据暂时无法加载。"
                    : available === undefined
                      ? "正在读取节日…"
                      : "所选地区当天没有公共节日。",
              )}
            </p>
          )}
          {dateChanges.length ? (
            <p className="calendar-note">
              <a href={`#${id}-zones`}>{t("当天有时钟切换，查看详情")}</a>
            </p>
          ) : null}
        </Card>
      </div>

      <Card as="section" className="panel calendar-holiday-panel">
        <div className="panel-heading">
          <h2>{t("本月公共节日")}</h2>
        </div>
        <ToggleGroup
          type="multiple"
          aria-label={t("节日地区")}
          className="calendar-region-picker"
          value={regions}
          onValueChange={(values) =>
            setRegions(holidayRegions.filter((code) => values.includes(code)))
          }
        >
          {holidayRegions.map((code) => (
            <ToggleGroupItem key={code} className="filter-pill" value={code}>
              {regionNames.of(code)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {monthHolidays.length ? (
          <ul className="calendar-month-holidays">
            {monthHolidays.map((holiday) => (
              <li key={`${holiday.date}|${holiday.region}|${holiday.name}`}>
                <Button
                  className="calendar-holiday-link"
                  onClick={() => setSelected(parseDate(holiday.date))}
                >
                  <time dateTime={holiday.date}>{holiday.date.slice(5)}</time>
                  <Badge className="calendar-tag">
                    {regionNames.of(holiday.region)}
                  </Badge>
                  <span>{holiday.name}</span>
                  {holiday.substitute ? (
                    <Badge className="calendar-tag">{t("补假")}</Badge>
                  ) : null}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted calendar-note" role="status">
            {t(
              !regions.length
                ? "请选择节日地区。"
                : available === null
                  ? "节日数据暂时无法加载。"
                  : available === undefined
                    ? "正在读取节日…"
                    : "所选地区本月没有公共节日。",
            )}
          </p>
        )}
        <p className="muted calendar-note">
          {t(
            "公共节日仅供参考，不含全部地方节日或调休上班安排。以当地公告为准。",
          )}{" "}
          <a
            href="https://github.com/commenthol/date-holidays"
            rel="noreferrer"
            target="_blank"
          >
            date-holidays
          </a>
          {" · "}
          <a
            href="/licenses/date-holidays.txt"
            rel="noreferrer"
            target="_blank"
          >
            ISC / CC BY-SA
          </a>
        </p>
      </Card>

      <Card
        as="section"
        className="panel calendar-zone-panel"
        id={`${id}-zones`}
      >
        <div className="panel-heading">
          <h2>{t("夏令时与标准时间")}</h2>
          <Select
            className="field"
            aria-label={t("时区地区")}
            value={zone}
            onValueChange={setZone}
          >
            {calendarZones.map((item) => (
              <SelectItem key={item.id} value={item.tz}>
                {item.flag} {t(item.name)} · {item.tz}
              </SelectItem>
            ))}
          </Select>
        </div>
        <p className="calendar-zone-summary">
          <span>
            {t("所选日期当地中午")} · {key}
          </span>{" "}
          <ZoneInfo reading={reading} />
        </p>
        {changes.length ? (
          <div className="calendar-table-wrap">
            <table className="calendar-transitions">
              <caption className="sr-only">{t("时钟切换")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("时钟切换")}</th>
                  <th scope="col">{t("切换前当地时间")}</th>
                  <th scope="col">{t("切换后当地时间")}</th>
                  <th scope="col">UTC</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr
                    key={change.utc}
                    data-selected={change.date === key || undefined}
                  >
                    <th scope="row">
                      <Button
                        className="calendar-transition-link"
                        onClick={() => setSelected(parseDate(change.date))}
                      >
                        <time dateTime={change.date}>{change.date}</time>
                        <span>{t(changeNames[change.kind])}</span>
                      </Button>
                    </th>
                    <td>
                      <div>{change.wallBefore}</div>
                      <ZoneInfo reading={change.before} />
                    </td>
                    <td>
                      <div>{change.wallAfter}</div>
                      <ZoneInfo reading={change.after} />
                    </td>
                    <td>{change.utc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted calendar-note">
            {t("{year} 年该时区没有时钟切换。", { year })}
          </p>
        )}
        <p className="muted calendar-note">
          {t(
            "切换时间依据浏览器时区规则；未来安排可能随当地法规和设备数据更新而变化。",
          )}
        </p>
      </Card>
    </div>
  );
});
