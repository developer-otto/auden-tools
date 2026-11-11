"use client";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Select, SelectItem } from "../ui/select";
import { Button } from "../ui/button";
import { memo, useMemo, useState } from "react";
import { cities, defaultCities, type City } from "../../lib/catalog";
import { usePreference } from "../../lib/preferences";
import {
  dateParts,
  formatLocal,
  offsetLabel,
  parseLocal,
  timeIn,
} from "../../lib/time";
import { Icon } from "../icon";
import { DatePicker } from "../ui/date-picker";
import { useApp, useNow } from "../providers";
import {
  AnalogClock,
  CatalogPicker,
  DetailHeader,
  Flag,
  Notice,
} from "../shared";

const validCities = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set([
          "shanghai",
          ...value.filter(
            (id): id is string =>
              typeof id === "string" && cities.some((city) => city.id === id),
          ),
        ]),
      ]
    : defaultCities;
const validBoolean = (value: unknown) => value === true;
function CityCard({
  city,
  now,
  hour12,
}: {
  city: City;
  now: Date;
  hour12: boolean;
}) {
  const { t, locale } = useApp(),
    p = dateParts(now, city.tz),
    night = Number(p.hour) < 7 || Number(p.hour) >= 19;
  return (
    <article
      className={`city-card ${city.local ? "local" : night ? "night" : ""}`}
    >
      <div className="city-top">
        <h3 className="city-name-with-flag">
          <Flag item={city} small />
          {t(city.name)}
        </h3>
        {city.local ? (
          <Badge className="local-badge">{t("参考城市")}</Badge>
        ) : (
          <Icon name={night ? "moon" : "sun"} />
        )}
      </div>
      <p className="city-country">
        {t(city.country)} · {offsetLabel(city.tz, now)}
      </p>
      <AnalogClock date={now} zone={city.tz} large />
      <div className="city-time">{timeIn(city.tz, now, locale, hour12)}</div>
      <p className="city-date">
        {new Intl.DateTimeFormat(locale, {
          month: "long",
          day: "numeric",
          weekday: "short",
          timeZone: city.tz,
        }).format(now)}
      </p>
      <div className="city-footer">
        <span>
          <Icon name={night ? "moon" : "sun"} />
          {t(night ? "夜间时光" : "日间时光")}
        </span>
        <span>{city.tz.split("/").at(-1)?.replaceAll("_", " ")}</span>
      </div>
    </article>
  );
}
const Meeting = memo(function Meeting({
  selected,
  today,
  hour12,
}: {
  selected: string[];
  today: string;
  hour12: boolean;
}) {
  const { t, locale, copy } = useApp(),
    [date, setDate] = useState(today),
    [hour, setHour] = useState(16);
  const reference = useMemo(() => {
    try {
      return Array.from(
        { length: 12 },
        (_, index) =>
          parseLocal(
            `${date}T${String(index + 8).padStart(2, "0")}:00`,
            "Asia/Shanghai",
          )[0]!,
      );
    } catch {
      return [];
    }
  }, [date]);
  const shown = selected
      .map((id) => cities.find((city) => city.id === id)!)
      .filter(Boolean),
    moment = reference[hour - 8];
  const summary = moment
    ? shown
        .map(
          (city) =>
            `${t(city.name)} ${formatLocal(moment, city.tz).slice(0, 10)} ${timeIn(city.tz, moment, locale, hour12)}`,
        )
        .join(" · ")
    : "";
  return (
    <Card as="section">
      <div className="panel-heading">
        <h2 className="meeting-title">
          <Icon name="calendar" />
          {t("找个好时间")}
        </h2>
        <span className="subtle">{t("跨时区会议，一起安排")}</span>
      </div>
      <div className="meeting-inputs">
        <label htmlFor="meeting-date">{t("计划日期")}</label>
        <DatePicker id="meeting-date" value={date} onChange={setDate} />
        <label htmlFor="meeting-hour">{t("上海时间")}</label>
        <Select
          id="meeting-hour"
          className="field"
          value={hour}
          onValueChange={(value) => setHour(Number(value))}
        >
          {Array.from({ length: 12 }, (_, index) => (
            <SelectItem key={index} value={index + 8}>
              {String(index + 8).padStart(2, "0")}:00
            </SelectItem>
          ))}
        </Select>
        <Button
          className="button small"
          disabled={!summary}
          onClick={() => copy(summary)}
        >
          <Icon name="copy" />
          {t("复制时间")}
        </Button>
      </div>
      {reference.length ? (
        <div
          className="timeline-scroll"
          tabIndex={0}
          aria-label={t("跨时区会议，一起安排")}
        >
          <div className="time-grid">
            <span className="hour-label">{t("上海时间")}</span>
            {reference.map((date, index) => (
              <span className="hour-label" key={date.getTime()}>
                {String(index + 8).padStart(2, "0")}:00
              </span>
            ))}
            {shown.map((city) => (
              <div className="timeline-row" key={city.id}>
                <span className="timeline-city">{t(city.name)}</span>
                {reference.map((date, index) => {
                  const p = dateParts(date, city.tz),
                    h = Number(p.hour);
                  return (
                    <Button
                      key={date.getTime()}
                      className={`timeline-cell ${h >= 9 && h < 18 ? "work" : ""} ${hour === index + 8 ? "selected" : ""}`}
                      onClick={() => setHour(index + 8)}
                      aria-label={`${t(city.name)} ${formatLocal(date, city.tz)}`}
                      aria-pressed={hour === index + 8}
                    >
                      {p.hour}
                    </Button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="validation-error">{t("请输入完整的日期和时间。")}</p>
      )}
      <div className="timeline-legend">
        <span>
          <i className="legend-box" />
          {t("工作时间 09–18")}
        </span>
        <span>
          <i className="legend-box rest" />
          {t("休息时间")}
        </span>
        <span>
          <i className="legend-box selected" />
          {t("选中时间")}
        </span>
      </div>
      {summary ? <Notice icon="globe">{summary}</Notice> : null}
    </Card>
  );
});
export default function WorldTool() {
  const { t } = useApp(),
    now = new Date(useNow()),
    [picker, setPicker] = useState(false);
  const [selected, setSelected] = usePreference(
      "cities",
      defaultCities,
      validCities,
    ),
    [hour12, setHour12] = usePreference("hour12", false, validBoolean);
  const selectAll = () => setSelected(cities.map((city) => city.id));
  return (
    <>
      <DetailHeader
        id="world"
        description="此刻的世界，一眼尽收。找到适合彼此的时间。"
      >
        <Button
          className="button primary"
          aria-label={t("管理城市")}
          onClick={() => setPicker(true)}
        >
          <Icon name="plus" />
          {t("管理城市")}
        </Button>
      </DetailHeader>
      <div className="world-toolbar">
        <div className="segmented">
          {[false, true].map((value) => (
            <Button
              key={String(value)}
              className={value === hour12 ? "active" : ""}
              aria-pressed={value === hour12}
              onClick={() => setHour12(value)}
            >
              {t(value ? "12 小时制" : "24 小时制")}
            </Button>
          ))}
        </div>
        <span className="world-now">
          <i className="live-dot" />
          {t("当前时间 · 自动更新")}
        </span>
      </div>
      <div className="catalog-summary">
        <span>
          <Icon name="globe" />
          <strong>24</strong>
          {t("个常用城市")}
          <span className="summary-divider">/</span>
          {t("已关注 {count} 个", { count: selected.length })}
        </span>
        <div>
          <Button className="text-btn" onClick={selectAll}>
            {t("显示全部 24 城市")}
          </Button>
          <Button
            className="text-btn"
            onClick={() => setSelected(defaultCities)}
          >
            {t("恢复常用")}
          </Button>
        </div>
      </div>
      <div className="city-grid">
        {selected.map((id) => (
          <CityCard
            key={id}
            city={cities.find((city) => city.id === id)!}
            now={now}
            hour12={hour12}
          />
        ))}
      </div>
      <Meeting
        selected={selected}
        today={formatLocal(now).slice(0, 10)}
        hour12={hour12}
      />
      <div className="bottom-note">
        <Icon name="help" />
        {t("日期与时差按所选时区计算，已考虑夏令时。")}
      </div>
      {picker ? (
        <CatalogPicker
          title="管理世界时间"
          description="24 个常用城市，找到你关心的时区。"
          items={cities}
          selected={selected}
          disabled={(city) => Boolean(city.local)}
          meta={(city) => offsetLabel(city.tz, now)}
          footer={t("已关注 {count} / {total} 个城市", {
            count: selected.length,
            total: cities.length,
          })}
          onSelect={(city) =>
            setSelected((previous) =>
              previous.includes(city.id)
                ? previous.filter((id) => id !== city.id)
                : [...previous, city.id],
            )
          }
          onSelectAll={selectAll}
          onClose={() => setPicker(false)}
        />
      ) : null}
    </>
  );
}
