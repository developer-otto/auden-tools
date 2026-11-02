"use client";
import { useMemo, useState } from "react";
import { timeZones } from "../../lib/catalog";
import {
  formatLocal,
  offsetLabel,
  parseEpoch,
  parseLocal,
} from "../../lib/time";
import { Icon } from "../icon";
import { useApp, useNow } from "../providers";
import {
  CatalogPicker,
  CopyButton,
  DetailHeader,
  Flag,
  Notice,
} from "../shared";

export default function TimestampTool() {
  const { t } = useApp(),
    now = useNow();
  const [mode, setMode] = useState<"to-date" | "to-epoch">("to-date");
  const [epoch, setEpoch] = useState(() => String(Math.floor(now / 1000))),
    [local, setLocal] = useState(() =>
      formatLocal(new Date(now), "Asia/Shanghai", true),
    );
  const [unit, setUnit] = useState<"seconds" | "milliseconds">("seconds"),
    [zone, setZone] = useState("Asia/Shanghai"),
    [overlap, setOverlap] = useState("earlier"),
    [picker, setPicker] = useState(false);
  const selected = timeZones.find((item) => item.tz === zone)!;
  const result = useMemo(() => {
    try {
      const candidates =
        mode === "to-date"
          ? [parseEpoch(epoch, unit)]
          : parseLocal(local, zone);
      return {
        date: overlap === "later" ? candidates.at(-1)! : candidates[0]!,
        ambiguous: candidates.length > 1,
        error: "",
      };
    } catch (error) {
      return {
        date: null,
        ambiguous: false,
        error:
          error instanceof Error
            ? error.message
            : "日期或时间无效，请检查输入。",
      };
    }
  }, [mode, epoch, unit, local, zone, overlap]);
  const date = result.date;
  const output: [string, string][] = !date
    ? []
    : mode === "to-date"
      ? [
          [
            "当地日期时间",
            formatLocal(date, zone, unit === "milliseconds").replace("T", " "),
          ],
          ["ISO 8601 / UTC", date.toISOString()],
          ["结果时区", `${t(selected.name)} · ${offsetLabel(zone, date)}`],
          ["IANA 标识", zone],
        ]
      : [
          ["秒级时间戳", String(Math.floor(date.getTime() / 1000))],
          ["毫秒级时间戳", String(date.getTime())],
          ["ISO 8601 / UTC", date.toISOString()],
          ["输入时区", `${t(selected.name)} · ${offsetLabel(zone, date)}`],
        ];
  const chooseZone = (value: string) => {
    setZone(value);
    setOverlap("earlier");
    setPicker(false);
  };
  const fillNow = () => {
    if (mode === "to-date")
      setEpoch(String(unit === "seconds" ? Math.floor(now / 1000) : now));
    else setLocal(formatLocal(new Date(now), zone, true));
  };
  const changeMode = (value: typeof mode) => {
    if (date) {
      if (value === "to-date")
        setEpoch(
          String(
            unit === "seconds"
              ? Math.floor(date.getTime() / 1000)
              : date.getTime(),
          ),
        );
      else setLocal(formatLocal(date, zone, true));
    }
    setMode(value);
  };
  return (
    <>
      <DetailHeader
        id="timestamp"
        description="24 个城市时区 + UTC。时间戳与当地时间，双向转换。"
      />
      <div className="current-timestamp">
        <div>
          <div className="label">
            <i className="live-dot" />
            {t("当前 Unix 时间戳")}
          </div>
          <div className="value">{Math.floor(now / 1000)}</div>
        </div>
        <div className="right-time">
          <span>
            {formatLocal(new Date(now)).replace("T", " ")}
            <span className="live-zone-caption">{t("Asia/Shanghai · 秒")}</span>
          </span>
          <CopyButton
            value={String(Math.floor(now / 1000))}
            label="复制当前时间戳"
          />
        </div>
      </div>
      <div className="detail-columns">
        <section className="panel">
          <div className="conversion-tabs">
            <button
              className={mode === "to-date" ? "active" : ""}
              aria-pressed={mode === "to-date"}
              onClick={() => changeMode("to-date")}
            >
              {t("时间戳 → 日期时间")}
            </button>
            <button
              className={mode === "to-epoch" ? "active" : ""}
              aria-pressed={mode === "to-epoch"}
              onClick={() => changeMode("to-epoch")}
            >
              {t("日期时间 → 时间戳")}
            </button>
          </div>
          <label className="input-label" htmlFor="timestamp-input">
            {t(mode === "to-date" ? "输入时间戳" : "输入当地日期时间")}
          </label>
          <div className="input-row">
            {mode === "to-date" ? (
              <input
                id="timestamp-input"
                className="field mono"
                inputMode="numeric"
                value={epoch}
                maxLength={20}
                onChange={(event) => setEpoch(event.target.value)}
              />
            ) : (
              <input
                id="timestamp-input"
                className="field mono"
                type="datetime-local"
                step="0.001"
                min="0001-01-01T00:00"
                max="9999-12-31T23:59:59.999"
                value={local}
                onChange={(event) => {
                  setLocal(event.target.value);
                  setOverlap("earlier");
                }}
              />
            )}
            {mode === "to-date" ? (
              <select
                name="timestamp-unit"
                className="field"
                value={unit}
                aria-label={t("时间戳单位")}
                onChange={(event) =>
                  setUnit(
                    event.target.value === "seconds"
                      ? "seconds"
                      : "milliseconds",
                  )
                }
              >
                <option value="seconds">{t("秒（s）")}</option>
                <option value="milliseconds">{t("毫秒（ms）")}</option>
              </select>
            ) : null}
          </div>
          <div className="field-group">
            <div className="field-heading">
              <label
                className="input-label"
                id="zone-field-label"
                htmlFor="timezone-picker"
              >
                {t(mode === "to-date" ? "结果时区" : "输入时区")}
              </label>
              <span>{t("25 个时区可选")}</span>
            </div>
            <button
              id="timezone-picker"
              className="timezone-picker"
              aria-labelledby="zone-field-label"
              onClick={() => setPicker(true)}
            >
              <Flag item={selected} small />
              <span>
                <strong>
                  {t(selected.name)}{" "}
                  <small>{offsetLabel(zone, date || new Date(now))}</small>
                </strong>
                <small>{zone}</small>
              </span>
              <Icon name="down" />
            </button>
            <div className="zone-shortcuts">
              {["Asia/Shanghai", "UTC", "America/New_York", "Asia/Dubai"].map(
                (tz) => {
                  const item = timeZones.find((item) => item.tz === tz)!;
                  return (
                    <button
                      key={tz}
                      className={tz === zone ? "active" : ""}
                      aria-pressed={tz === zone}
                      onClick={() => chooseZone(tz)}
                    >
                      {item.flag} {tz === "UTC" ? "UTC" : t(item.name)}
                    </button>
                  );
                },
              )}
            </div>
          </div>
          {result.ambiguous ? (
            <div className="field-group">
              <label className="input-label" htmlFor="overlap">
                {t("这个当地时间出现两次，请选择")}
              </label>
              <select
                className="field"
                id="overlap"
                value={overlap}
                onChange={(event) => setOverlap(event.target.value)}
              >
                <option value="earlier">{t("第一次（时钟回拨前）")}</option>
                <option value="later">{t("第二次（时钟回拨后）")}</option>
              </select>
            </div>
          ) : null}
          <div className="button-row">
            <button className="button primary" onClick={fillNow}>
              <Icon name="clock" />
              {t("使用当前时间")}
            </button>
          </div>
          <div className="results-box">
            <div className="results-title">
              <span>{t("转换结果")}</span>
              <CopyButton
                value={output
                  .map(([label, value]) => `${t(label)}: ${value}`)
                  .join("\n")}
                label="复制转换结果"
                disabled={!date}
              />
            </div>
            {date ? (
              output.map(([label, value]) => (
                <div className="result-line" key={label}>
                  <span>{t(label)}</span>
                  <strong>{value}</strong>
                </div>
              ))
            ) : (
              <p className="muted">{t("等待有效输入")}</p>
            )}
          </div>
          {result.error ? (
            <p className="validation-error" role="alert">
              {t(result.error)}
            </p>
          ) : null}
        </section>
        <aside className="panel">
          <div className="panel-heading">
            <h2>{t("关于时间与时区")}</h2>
            <Icon name="globe" />
          </div>
          <div className="timezone-coverage">
            <strong>25</strong>
            <span>
              {t("个常用时区")}
              <small>{t("亚洲 · 欧洲 · 美洲 · 大洋洲 · UTC")}</small>
            </span>
          </div>
          <div className="help-list">
            <div className="help-item">
              <span>UNIX TIMESTAMP</span>
              <p>
                {t(
                  "从 1970 年 1 月 1 日 00:00:00 UTC 起，经过的秒数。同一时间戳始终代表同一个瞬间。",
                )}
              </p>
            </div>
            <div className="help-item">
              <span>{t("秒 / 毫秒")}</span>
              <p>
                {t("秒级时间戳通常为 10 位，毫秒级通常为 13 位。")}
                <br />
                <code>{t("1 秒 = 1,000 毫秒")}</code>
              </p>
            </div>
            <div className="help-item">
              <span>{t("自动处理夏令时")}</span>
              <p>
                {t(
                  "按照所选日期的时区规则转换。回拨造成的重复时间可选择前后两次，跳时造成的不存在时间会提示调整。",
                )}
              </p>
            </div>
          </div>
          <Notice>{t("输入内容仅在当前浏览器中处理。")}</Notice>
        </aside>
      </div>
      {picker ? (
        <CatalogPicker
          title="选择时区"
          description="24 个城市时区 + UTC，支持夏令时。"
          items={timeZones}
          selected={[selected.id]}
          multiple={false}
          meta={(item) => offsetLabel(item.tz, new Date(now))}
          footer={t("UTC 偏移按当前日期显示，转换使用输入日期的时区规则。")}
          onSelect={(item) => chooseZone(item.tz)}
          onClose={() => setPicker(false)}
        />
      ) : null}
    </>
  );
}
