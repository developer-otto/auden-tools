"use client";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Select, SelectItem } from "../ui/select";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useId, useMemo, useState } from "react";
import {
  currencies,
  currencyDigits,
  defaultCurrencies,
  type Currency,
} from "../../lib/catalog";
import * as decimal from "../../lib/decimal";
import { usePreference } from "../../lib/preferences";
import {
  isCurrencyCode,
  type RateHistory,
  type RatesSnapshot,
} from "../../lib/rates";
import { useRemote } from "../../lib/use-remote";
import { Icon } from "../icon";
import { useApp } from "../providers";
import { CatalogPicker, CopyButton, DetailHeader, Flag } from "../shared";

const validCodes = (input: unknown): string[] =>
  Array.isArray(input)
    ? [
        ...new Set(
          input.filter(
            (code): code is string =>
              typeof code === "string" && isCurrencyCode(code),
          ),
        ),
      ]
    : defaultCurrencies;
const validBase = (input: unknown) =>
  typeof input === "string" && isCurrencyCode(input) ? input : "CNY";
function RateTrend({ base }: { base: string }) {
  const { t, locale } = useApp(),
    [preferred, setPreferred] = useState("USD"),
    gradientId = useId();
  const quote =
    preferred === base ? (base === "USD" ? "CNY" : "USD") : preferred;
  const { data, loading, error, retry } = useRemote<RateHistory>(
    `/api/rates/history?base=${base}&quote=${quote}`,
  );
  const chart = useMemo(() => {
    if (!data || data.points.length < 2) return null;
    const points = data.points,
      first = points[0]!,
      last = points.at(-1)!;
    const high = points.reduce((a, b) =>
        decimal.subtract(a.rate, b.rate).n > 0n ? a : b,
      ),
      low = points.reduce((a, b) =>
        decimal.subtract(a.rate, b.rate).n < 0n ? a : b,
      );
    // Number is used only for screen coordinates; all financial results remain exact.
    const min = Number(low.rate),
      max = Number(high.rate),
      range = max - min || max * 0.01;
    const firstTime = Date.parse(first.date),
      elapsed = Date.parse(last.date) - firstTime || 1;
    const line = points
      .map(
        (point) =>
          `${(((Date.parse(point.date) - firstTime) / elapsed) * 320).toFixed(2)},${(130 - ((Number(point.rate) - min) / range) * 110).toFixed(2)}`,
      )
      .join(" ");
    const change = decimal.round(
      decimal.multiply(
        decimal.divide(decimal.subtract(last.rate, first.rate), first.rate),
        "100",
      ),
      2,
    );
    return { first, last, high, low, line, change };
  }, [data]);
  return (
    <Card as="section">
      <div className="panel-heading">
        <h2>
          {base} / {quote}
        </h2>
        <Select
          name="chart-quote"
          className="field compact-field"
          value={quote}
          aria-label={t("走势对照货币")}
          onValueChange={(value) => setPreferred(value)}
        >
          {currencies
            .filter((currency) => currency.code !== base)
            .map((currency) => (
              <SelectItem key={currency.code} value={currency.code}>
                {currency.code}
              </SelectItem>
            ))}
        </Select>
      </div>
      <p className="muted small-copy">{t("过去 30 天")}</p>
      {chart ? (
        <>
          <div className="trend-value">
            {decimal.format(decimal.round(chart.last.rate, 8), locale, true)}
            <span>{quote}</span>
          </div>
          <div
            className={`trend-change ${chart.change.startsWith("-") ? "negative" : ""}`}
          >
            <Icon name="chart" />
            {chart.change.startsWith("-") ? "" : "+"}
            {chart.change}%
          </div>
          <svg
            className="trend-chart"
            viewBox="0 0 320 150"
            role="img"
            aria-label={`${base}/${quote} ${t("过去 30 天")}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8fab76" stopOpacity=".2" />
                <stop offset="100%" stopColor="#8fab76" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 30H320M0 75H320M0 120H320"
              stroke="var(--line)"
              strokeDasharray="3 5"
            />
            <polygon
              points={`0,150 ${chart.line} 320,150`}
              fill={`url(#${gradientId})`}
            />
            <polyline
              points={chart.line}
              fill="none"
              stroke="#879f70"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          <div className="chart-labels">
            <span>{chart.first.date}</span>
            <span>{chart.last.date}</span>
          </div>
          <div className="rate-detail-list">
            <div>
              <span>{t("30 天最高")}</span>
              <strong>
                {chart.high.rate} {quote}
              </strong>
            </div>
            <div>
              <span>{t("30 天最低")}</span>
              <strong>
                {chart.low.rate} {quote}
              </strong>
            </div>
            <div>
              <span>{t("数据来源")}</span>
              <a
                href="https://frankfurter.dev/"
                target="_blank"
                rel="noreferrer"
              >
                Frankfurter ↗
              </a>
            </div>
          </div>
        </>
      ) : (
        <p className="chart-empty" role="status">
          {t(
            loading
              ? "加载走势…"
              : error
                ? "暂时无法加载走势。"
                : "暂无足够的历史数据。",
          )}
        </p>
      )}
      {error ? (
        <Button className="text-btn" onClick={retry}>
          {t("重试")}
        </Button>
      ) : null}
    </Card>
  );
}
export default function CurrencyTool() {
  const { t, locale } = useApp(),
    [amount, setAmount] = useState("1000"),
    [picker, setPicker] = useState<"base" | "targets" | null>(null);
  const [baseCode, setBaseCode] = usePreference(
      "base-currency",
      "CNY",
      validBase,
    ),
    [selected, setSelected] = usePreference(
      "currencies",
      defaultCurrencies,
      validCodes,
    );
  const { data, loading, error, retry } =
    useRemote<RatesSnapshot>("/api/rates");
  const base = currencies.find((currency) => currency.code === baseCode)!;
  const shown = selected
    .filter((code) => code !== baseCode)
    .map((code) => currencies.find((currency) => currency.code === code)!);
  let valid = false;
  try {
    valid = decimal.parse(amount).n >= 0n;
  } catch {
    /* An invalid amount has no conversion result. */
  }
  const baseRate = data?.rates[baseCode];
  const dates = data
    ? [...new Set(Object.values(data.rates).map((row) => row.date))].sort()
    : [];
  const dateLabel = dates.length
    ? dates[0] === dates.at(-1)
      ? dates[0]
      : `${dates[0]} – ${dates.at(-1)}`
    : "—";
  const selectAll = () =>
    setSelected(
      currencies
        .filter((currency) => currency.code !== baseCode)
        .map((currency) => currency.code),
    );
  const choose = (currency: Currency) => {
    if (picker === "base") {
      if (currency.code !== baseCode) {
        setSelected((previous) => [
          ...new Set([
            ...previous.filter((code) => code !== currency.code),
            baseCode,
          ]),
        ]);
        setBaseCode(currency.code);
      }
      setPicker(null);
    } else
      setSelected((previous) =>
        previous.includes(currency.code)
          ? previous.filter((code) => code !== currency.code)
          : [...previous, currency.code],
      );
  };
  return (
    <>
      <DetailHeader
        id="currency"
        description="24 种常见货币，带上熟悉的旗帜。一个金额，一次看清。"
      >
        <Button
          className="button primary"
          aria-label={t("管理货币")}
          onClick={() => setPicker("targets")}
        >
          <Icon name="plus" />
          {t("管理货币")}
        </Button>
      </DetailHeader>
      <div className="detail-columns currency-columns">
        <Card as="section">
          <div className="panel-heading">
            <h2>{t("多币种换算")}</h2>
            <Badge className="reference-badge">{t("每日参考汇率")}</Badge>
          </div>
          <label className="input-label" htmlFor="currency-amount">
            {t("输入金额")}
          </label>
          <div className="amount-input">
            <Input
              id="currency-amount"
              inputMode="decimal"
              maxLength={220}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <Button
              className="currency-base-picker"
              aria-label={t("选择基础货币，目前为{name}", {
                name: t(base.name),
              })}
              onClick={() => setPicker("base")}
            >
              <Flag item={base} small />
              <span>
                <strong>{base.code}</strong>
                <small>{t(base.name)}</small>
              </span>
              <Icon name="down" />
            </Button>
          </div>
          {!valid && amount ? (
            <p className="validation-error" role="alert">
              {t("请输入不小于 0 的有效金额（最多 200 位数字）。")}
            </p>
          ) : null}
          {error ? (
            <div className="data-error" role="alert">
              <span>
                {t(
                  data
                    ? "刷新失败，正在显示上次获取的汇率。"
                    : "暂时无法获取汇率，请稍后重试。",
                )}
              </span>
              <Button className="button small" onClick={retry}>
                {t("重试")}
              </Button>
            </div>
          ) : null}
          <div className="currency-results-heading">
            <div>
              <h2>{t("换算结果")}</h2>
              <span>
                {t("已选 {count} 种 · 共 {total} 种可选", {
                  count: shown.length,
                  total: currencies.length,
                })}
              </span>
            </div>
            <Button className="text-btn" onClick={selectAll}>
              {t("显示全部 {count} 种", { count: currencies.length - 1 })}
              <Icon name="right" />
            </Button>
          </div>
          <div className="currency-list" aria-busy={loading}>
            {shown.length ? (
              shown.map((currency) => {
                const target = data?.rates[currency.code];
                const rounded =
                  valid && baseRate && target
                    ? decimal.convertAmount(
                        amount,
                        baseRate.rate,
                        target.rate,
                        currencyDigits(currency.code),
                      )
                    : null;
                const rate =
                  baseRate && target
                    ? decimal.round(
                        decimal.divide(target.rate, baseRate.rate),
                        8,
                      )
                    : null;
                const date =
                  baseRate && target
                    ? baseRate.date === target.date
                      ? target.date
                      : `${baseRate.date} / ${target.date}`
                    : "";
                return (
                  <div className="currency-row" key={currency.code}>
                    <Flag item={currency} />
                    <div className="currency-info">
                      {currency.code}
                      <small>
                        {t(currency.name)} · {t(currency.country)}
                      </small>
                    </div>
                    <div className="currency-total">
                      {rounded !== null ? decimal.format(rounded, locale) : "—"}
                      <small>
                        {rate
                          ? `1 ${baseCode} = ${decimal.format(rate, locale, true)} ${currency.code}`
                          : t(loading ? "加载汇率…" : "汇率暂不可用")}
                        <br />
                        {date}
                      </small>
                    </div>
                    <div className="currency-row-actions">
                      <CopyButton
                        value={rounded || ""}
                        disabled={rounded === null}
                        label={t("复制{name}金额", { name: t(currency.name) })}
                      />
                      <Button
                        className="icon-btn remove-currency"
                        aria-label={t("移除{name}", { name: t(currency.name) })}
                        onClick={() =>
                          setSelected((previous) =>
                            previous.filter((code) => code !== currency.code),
                          )
                        }
                      >
                        <Icon name="close" />
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <h3>{t("选择要对照的货币")}</h3>
                <p>{t("点击“管理货币”，添加你常用的币种。")}</p>
              </div>
            )}
          </div>
          <Button className="add-currency" onClick={() => setPicker("targets")}>
            <Icon name="plus" />
            {t("管理货币 · 搜索 24 种常用币种")}
          </Button>
          <p className="precision-note">
            {t("按币种小数位四舍五入，计算过程保留精度。")}
          </p>
          <div className="source-note">
            <Icon name="help" />
            <span>
              {t("数据来源")}：
              <a
                href="https://frankfurter.dev/"
                target="_blank"
                rel="noreferrer"
              >
                Frankfurter ↗
              </a>{" "}
              · {t("数据日期")}：{dateLabel}
            </span>
            <Button className="text-btn" disabled={loading} onClick={retry}>
              {t(loading ? "加载汇率…" : "刷新")}
            </Button>
          </div>
        </Card>
        <aside className="detail-side">
          <RateTrend base={baseCode} />
          <section className="tip-panel">
            <h3>
              <Icon name="spark" />
              {t("换算小提示")}
            </h3>
            <p>
              {t(
                "参考汇率帮助你快速估算金额。实际支付或兑换金额，还会受到银行报价与手续费的影响。",
              )}
            </p>
            <p>
              {t("不同币种的数据可能来自不同发布日期，日期已在结果中标注。")}
            </p>
          </section>
        </aside>
      </div>
      {picker ? (
        <CatalogPicker
          title={picker === "base" ? "选择基础货币" : "管理对照货币"}
          description="24 种常用货币，覆盖日常兑换与旅行。"
          items={currencies}
          selected={
            picker === "base"
              ? [baseCode]
              : selected.filter((code) => code !== baseCode)
          }
          multiple={picker !== "base"}
          disabled={(currency) =>
            picker === "targets" && currency.code === baseCode
          }
          meta={(currency) =>
            currency.code === baseCode ? t("基础货币") : currency.sign
          }
          onSelect={choose}
          onSelectAll={picker === "targets" ? selectAll : undefined}
          footer={t(
            picker === "base"
              ? "共 {count} 种货币可选"
              : "已选 {count} 种目标货币",
            { count: picker === "base" ? currencies.length : shown.length },
          )}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </>
  );
}
