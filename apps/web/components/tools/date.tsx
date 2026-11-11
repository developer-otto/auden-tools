"use client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useState } from "react";
import { addDays, daysBetween } from "../../lib/dates";
import { formatLocal } from "../../lib/time";
import { Icon } from "../icon";
import { DatePicker } from "../ui/date-picker";
import { useApp, useNow } from "../providers";
import { DetailHeader } from "../shared";

export default function DateTool() {
  const { t } = useApp(),
    today = formatLocal(new Date(useNow())).slice(0, 10);
  const [start, setStart] = useState(today),
    [end, setEnd] = useState(() => addDays(today, "30")),
    [base, setBase] = useState(today),
    [offset, setOffset] = useState("30");
  let days: number | null = null,
    result = "",
    intervalError = "",
    offsetError = "";
  try {
    days = daysBetween(start, end);
  } catch (error) {
    intervalError = t((error as Error).message);
  }
  try {
    result = addDays(base, offset);
  } catch (error) {
    offsetError = t((error as Error).message);
  }
  return (
    <>
      <DetailHeader id="date" description="从今天到那一天，每一天都算数。" />
      <div className="detail-columns">
        <Card as="section">
          <div className="panel-heading">
            <h2>{t("计算日期间隔")}</h2>
            <span className="subtle">{t("按自然日计算")}</span>
          </div>
          <div className="date-fields">
            <div className="field-group">
              <label className="input-label" htmlFor="date-start">
                {t("开始日期")}
              </label>
              <DatePicker id="date-start" value={start} onChange={setStart} />
            </div>
            <div className="field-group">
              <label className="input-label" htmlFor="date-end">
                {t("结束日期")}
              </label>
              <DatePicker id="date-end" value={end} onChange={setEnd} />
            </div>
          </div>
          <div className="results-box date-result">
            <strong>{days === null ? "—" : Math.abs(days)}</strong>
            <span>{t("天")}</span>
            {days !== null ? (
              <p>
                {days < 0 ? t("结束日期早于开始日期，") : ""}
                {t("相差 {weeks} 周 {days} 天 · 不含开始日", {
                  weeks: Math.floor(Math.abs(days) / 7),
                  days: Math.abs(days) % 7,
                })}
              </p>
            ) : null}
          </div>
          {intervalError ? (
            <p className="validation-error" role="alert">
              {intervalError}
            </p>
          ) : null}
          <div className="button-row">
            <Button className="button primary" onClick={() => setStart(today)}>
              <Icon name="calendar" />
              {t("从今天开始")}
            </Button>
          </div>
        </Card>
        <Card as="aside">
          <div className="panel-heading">
            <h2>{t("日期加减")}</h2>
          </div>
          <div className="field-group">
            <label className="input-label" htmlFor="date-base">
              {t("起始日期")}
            </label>
            <DatePicker id="date-base" value={base} onChange={setBase} />
          </div>
          <div className="field-group">
            <label className="input-label" htmlFor="date-offset">
              {t("增加或减少天数")}
            </label>
            <Input
              className="field"
              id="date-offset"
              inputMode="numeric"
              maxLength={9}
              value={offset}
              onChange={(event) => setOffset(event.target.value)}
            />
            <p className="precision-note">{t("输入负数可以向前推算日期。")}</p>
          </div>
          <div className="results-box">
            <span className="muted">{t("计算后的日期")}</span>
            <div className="compact-output">{result || "—"}</div>
          </div>
          {offsetError ? (
            <p className="validation-error" role="alert">
              {offsetError}
            </p>
          ) : null}
        </Card>
      </div>
    </>
  );
}
