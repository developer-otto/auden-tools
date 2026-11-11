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
import { loadSolarTerms, type SolarTerm } from "../../lib/solar-terms";
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
  const [view, setView] = useState<"month" | "year">("month");
  const [yearStart, setYearStart] = useState(
    () => new Date(Date.UTC(parseDate(today).getUTCFullYear(), 0, 1)),
  );
  const [zone, setZone] = useState("Asia/Shanghai");
  const [regions, setRegions] = useState<HolidayRegion[]>(defaultRegions);
  const [holidays, setHolidays] = useState<{
    key: string;
    items: CalendarHoliday[] | null;
  }>();
  const [solarTerms, setSolarTerms] = useState<{
    key: string;
    items: SolarTerm[] | null;
  }>();
  const year = selected.getUTCFullYear();
  const month = selected.getUTCMonth();
  const key = dateKey(selected);
  const todayDate = useMemo(() => parseDate(today), [today]);
  const visibleMonth = useMemo(
    () => new Date(Date.UTC(year, month, 1)),
    [year, month],
  );
  const annual = view === "year";
  const rangeYear = annual ? yearStart.getUTCFullYear() : year;
  const rangeMonth = annual ? yearStart.getUTCMonth() : month;
  const rangeEnd = useMemo(
    () => new Date(Date.UTC(rangeYear, rangeMonth + (annual ? 12 : 1), 0)),
    [rangeYear, rangeMonth, annual],
  );
  const rangeEndYear = rangeEnd.getUTCFullYear();
  const dataYears = useMemo(
    () =>
      rangeYear === rangeEndYear ? [rangeYear] : [rangeYear, rangeEndYear],
    [rangeYear, rangeEndYear],
  );
  const yearsKey = dataYears.join(",");
  const requestKey = `${yearsKey}|${locale}|${regions.join(",")}`;
  useEffect(() => {
    if (!regions.length) return;
    let canceled = false;
    Promise.all(dataYears.map((item) => loadHolidays(regions, item, locale)))
      .then((items) => {
        if (!canceled) setHolidays({ key: requestKey, items: items.flat() });
      })
      .catch(() => {
        if (!canceled) setHolidays({ key: requestKey, items: null });
      });
    return () => {
      canceled = true;
    };
  }, [dataYears, locale, regions, requestKey]);

  useEffect(() => {
    let canceled = false;
    Promise.all(dataYears.map(loadSolarTerms))
      .then((items) => {
        if (!canceled) setSolarTerms({ key: yearsKey, items: items.flat() });
      })
      .catch(() => {
        if (!canceled) setSolarTerms({ key: yearsKey, items: null });
      });
    return () => {
      canceled = true;
    };
  }, [dataYears, yearsKey]);

  const available = holidays?.key === requestKey ? holidays.items : undefined;
  const monthKey = key.slice(0, 7);
  const availableTerms =
    solarTerms?.key === yearsKey ? solarTerms.items : undefined;
  const monthTerms = useMemo(
    () =>
      (availableTerms ?? []).filter((term) => term.date.startsWith(monthKey)),
    [availableTerms, monthKey],
  );
  const termsByDate = useMemo(
    () => new Map((availableTerms ?? []).map((term) => [term.date, term])),
    [availableTerms],
  );
  const dateTerm = termsByDate.get(key);
  const monthHolidays = useMemo(
    () =>
      (available ?? []).filter((holiday) => holiday.date.startsWith(monthKey)),
    [available, monthKey],
  );
  const holidayDays = useMemo(
    () => new Set((available ?? []).map((item) => item.date)),
    [available],
  );
  const changesByYear = useMemo(
    () => new Map(dataYears.map((item) => [item, zoneChanges(zone, item)])),
    [dataYears, zone],
  );
  const changes = changesByYear.get(year) ?? [];
  const changeDays = useMemo(
    () =>
      new Set(
        [...changesByYear.values()].flatMap((items) =>
          items.map((change) => change.date),
        ),
      ),
    [changesByYear],
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

  const updateYearRange = (nextYear: number, nextMonth: number) => {
    const startMonth = nextYear === last.getUTCFullYear() ? 0 : nextMonth;
    const start = new Date(Date.UTC(nextYear, startMonth, 1));
    const end = new Date(Date.UTC(nextYear, startMonth + 12, 0));
    setYearStart(start);
    if (selected < start || selected > end) setSelected(start);
  };
  const selectDate = (date: Date) => {
    if (annual && (date < yearStart || date > rangeEnd)) setView("month");
    setSelected(date);
  };
  const showToday = () => {
    if (annual && (todayDate < yearStart || todayDate > rangeEnd))
      setYearStart(new Date(Date.UTC(todayDate.getUTCFullYear(), 0, 1)));
    setSelected(todayDate);
  };

  return (
    <div className="calendar-explorer">
      <div className="calendar-overview" data-view={view}>
        <Card as="section" className="panel calendar-month">
          <div className="panel-heading">
            <h2>{t(annual ? "公历年视图" : "日历表")}</h2>
            <Button className="button small" onClick={showToday}>
              {t("回到今天")}
            </Button>
          </div>
          <div className="calendar-controls">
            <ToggleGroup
              type="single"
              className="calendar-view-switch"
              aria-label={t("日历视图")}
              value={view}
              onValueChange={(value) => {
                if (value === "year") {
                  setYearStart(new Date(Date.UTC(year, 0, 1)));
                  setView("year");
                } else if (value === "month") setView("month");
              }}
            >
              <ToggleGroupItem className="filter-pill" value="month">
                {t("月视图")}
              </ToggleGroupItem>
              <ToggleGroupItem className="filter-pill" value="year">
                {t("年视图")}
              </ToggleGroupItem>
            </ToggleGroup>
            <Select
              className="field"
              aria-label={t("年份")}
              value={rangeYear}
              onValueChange={(value) =>
                annual
                  ? updateYearRange(Number(value), rangeMonth)
                  : setMonth(Number(value), month)
              }
            >
              {years.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </Select>
            <Select
              className="field"
              aria-label={t(annual ? "起始月份" : "月份")}
              value={rangeMonth}
              onValueChange={(value) =>
                annual
                  ? updateYearRange(rangeYear, Number(value))
                  : setMonth(year, Number(value))
              }
            >
              {months
                .slice(
                  0,
                  annual && rangeYear === last.getUTCFullYear() ? 1 : 12,
                )
                .map((item, index) => (
                  <SelectItem key={index} value={index}>
                    {monthNames.format(item)}
                  </SelectItem>
                ))}
            </Select>
          </div>
          {annual ? (
            <div className="calendar-year-summary">
              <span>
                <time dateTime={dateKey(yearStart)}>{dateKey(yearStart)}</time>{" "}
                – <time dateTime={dateKey(rangeEnd)}>{dateKey(rangeEnd)}</time>
              </span>
              <a href={`#${id}-day`}>{t("查看所选日期详情")}</a>
            </div>
          ) : null}
          <Calendar
            key={annual ? dateKey(yearStart) : view}
            className={`ui-calendar explorer-calendar${annual ? " calendar-year-grid" : ""}`}
            mode="single"
            required
            selected={selected}
            today={todayDate}
            month={annual ? yearStart : visibleMonth}
            numberOfMonths={annual ? 12 : 1}
            hideNavigation={annual}
            disableNavigation={annual}
            onMonthChange={
              annual
                ? undefined
                : (date) => setMonth(date.getUTCFullYear(), date.getUTCMonth())
            }
            onSelect={setSelected}
            locale={calendarLocales[locale]}
            timeZone="UTC"
            startMonth={annual ? yearStart : first}
            endMonth={annual ? rangeEnd : last}
            showOutsideDays={false}
            fixedWeeks
            modifiers={{
              holiday: (day) => holidayDays.has(dateKey(day)),
              zoneChange: (day) => changeDays.has(dateKey(day)),
              solarTerm: (day) => termsByDate.has(dateKey(day)),
            }}
            modifiersClassNames={{
              holiday: "calendar-holiday",
              zoneChange: "calendar-zone-change",
              solarTerm: "calendar-solar-term",
            }}
            labels={{
              labelDayButton: (day, modifiers, options) => {
                const term = modifiers.solarTerm
                  ? termsByDate.get(dateKey(day))
                  : undefined;
                return [
                  labelDayButton(day, modifiers, options),
                  modifiers.holiday ? t("公共节日") : "",
                  modifiers.zoneChange ? t("时钟切换") : "",
                  term ? t(term.name) : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
              },
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
            <span>
              <i className="calendar-dot solar-term-dot" />
              {t("二十四节气")}
            </span>
          </div>
          <div className="calendar-solar-terms">
            <span className="muted">
              {t(annual ? "所选月份节气（北京时间）" : "本月节气（北京时间）")}
            </span>
            {monthTerms.map((term) => (
              <Button
                className="filter-pill"
                key={term.date}
                aria-pressed={term.date === key}
                onClick={() => setSelected(parseDate(term.date))}
              >
                <time dateTime={term.date}>{term.date.slice(5)}</time>{" "}
                {t(term.name)}
              </Button>
            ))}
            {!availableTerms ? (
              <span className="muted" role="status">
                {t(
                  availableTerms === null
                    ? "节气数据暂时无法加载。"
                    : "正在计算节气…",
                )}
              </span>
            ) : null}
          </div>
        </Card>

        <Card
          as="section"
          className="panel calendar-day-detail"
          id={`${id}-day`}
        >
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
          {dateTerm ? (
            <div className="calendar-solar-detail">
              <Badge className="calendar-tag">{t("二十四节气")}</Badge>
              <strong>{t(dateTerm.name)}</strong>
              <span className="muted">
                {t("太阳黄经 {degrees}°", { degrees: dateTerm.longitude })}
              </span>
            </div>
          ) : null}
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
                        onClick={() => selectDate(parseDate(change.date))}
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
