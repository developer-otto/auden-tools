"use client";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import Link from "next/link";
import { useState } from "react";
import { cities, currencies, currencyDigits } from "../lib/catalog";
import { convertAmount, format } from "../lib/decimal";
import { matchesQuery } from "../lib/i18n";
import type { RatesSnapshot } from "../lib/rates";
import { formatLocal, timeIn } from "../lib/time";
import { categories, tools } from "../lib/tools";
import { useFavorites, useRecent } from "../lib/tool-preferences";
import { useRemote } from "../lib/use-remote";
import { Icon } from "./icon";
import { useApp, useNow } from "./providers";
import { AnalogClock, Flag, ToolCard } from "./shared";

function CurrencyPreview() {
  const { t, locale } = useApp(),
    { data, error, retry } = useRemote<RatesSnapshot>("/api/rates");
  const usd = data?.rates.USD;
  return (
    <Card as="article" className="feature-card feature-currency">
      <div className="feature-top">
        <Icon name="arrows" />
        <h3>{t("汇率换算")}</h3>
        <Link
          className="icon-btn"
          href="/tools/currency"
          aria-label={t("打开汇率换算")}
        >
          <Icon name="diagonal" />
        </Link>
      </div>
      {["CNY", "USD"].map((code) => (
        <div key={code} className="rate-preview">
          <span className="currency-name">
            <Flag
              item={currencies.find((currency) => currency.code === code)!}
              small
            />
            {code}
          </span>
          <span className="rate-value">
            {code === "CNY"
              ? format("1000.00", locale)
              : usd
                ? format(
                    convertAmount("1000", "1", usd.rate, currencyDigits("USD")),
                    locale,
                  )
                : "—"}
          </span>
        </div>
      ))}
      <div className="feature-bottom">
        {error ? (
          <Button className="text-btn" onClick={retry}>
            {t("重试")}
          </Button>
        ) : (
          <span className="preview-tag">{usd?.date || t("加载汇率…")}</span>
        )}
        <Link className="text-btn" href="/tools/currency">
          {t("开始换算")}
          <Icon name="right" />
        </Link>
      </div>
    </Card>
  );
}
export function Home({ filter = "all" }: { filter?: string }) {
  const { t, locale } = useApp(),
    { favorites } = useFavorites(),
    { recent } = useRecent(),
    now = new Date(useNow()),
    [query, setQuery] = useState("");
  const active = [
    "all",
    "favorites",
    "recent",
    ...Object.keys(categories),
  ].includes(filter)
    ? filter
    : "all";
  const displayed = tools.filter(
    (tool) =>
      (active === "all" ||
        tool.category === active ||
        (active === "favorites" && favorites.includes(tool.id)) ||
        (active === "recent" && recent.includes(tool.id))) &&
      matchesQuery(query, tool.name, tool.desc, tool.keywords, tool.id),
  );
  if (active === "recent")
    displayed.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  const title =
    (
      { favorites: "我的收藏", recent: "最近使用", ...categories } as Record<
        string,
        string
      >
    )[active] || "全部工具";
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">YOUR EVERYDAY TOOLKIT</p>
          <h1>{t("让日常，简单一点。")}</h1>
          <p className="hero-subtitle">
            {t("好用的小工具，帮你省下每一个不必浪费的瞬间。")}
          </p>
        </div>
        <div className="hero-date">
          <span className="day">
            {new Intl.DateTimeFormat(locale, {
              month: "2-digit",
              day: "2-digit",
              timeZone: "Asia/Shanghai",
            }).format(now)}
          </span>
          <span className="weekday">
            {new Intl.DateTimeFormat(locale, {
              weekday: "long",
              timeZone: "Asia/Shanghai",
            }).format(now)}{" "}
            ·{" "}
          </span>
          <span className="date-lower">{now.getUTCFullYear()}</span>
        </div>
      </section>
      <div className="search-bar">
        <Icon name="search" />
        <Input
          type="search"
          name="home-search"
          aria-label={t("搜索工具")}
          placeholder={t("想做点什么？搜索工具，例如：时间、汇率、JSON")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="key-hint">
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </span>
      </div>
      <section aria-label={t("常用工具")}>
        <div className="section-heading">
          <div className="section-title">
            <h2>{t("常用工具")}</h2>
            <span>{t("为日常，随手备好")}</span>
          </div>
          <Link className="text-btn" href="/?filter=favorites">
            {t("我的收藏")}
            <Icon name="right" />
          </Link>
        </div>
        <div className="featured-grid">
          <Card as="article" className="feature-card feature-world">
            <div className="feature-top">
              <Icon name="globe" />
              <h3>{t("世界时间")}</h3>
              <Link
                className="icon-btn"
                href="/tools/world"
                aria-label={t("打开世界时间")}
              >
                <Icon name="diagonal" />
              </Link>
            </div>
            <div className="mini-clocks">
              {cities.slice(0, 3).map((city) => (
                <div className="mini-city" key={city.id}>
                  <AnalogClock date={now} zone={city.tz} />
                  <span className="mini-city-name">{t(city.name)}</span>
                  <span className="mini-time">
                    {timeIn(city.tz, now, locale)}
                  </span>
                </div>
              ))}
            </div>
            <div className="feature-bottom">
              <span>{t("此刻，世界与你同步")}</span>
              <Link className="text-btn" href="/tools/world">
                {t("查看全部")}
                <Icon name="right" />
              </Link>
            </div>
          </Card>
          <CurrencyPreview />
          <Card as="article" className="feature-card feature-timestamp">
            <div className="feature-top">
              <Icon name="clock" />
              <h3>{t("时间戳转换")}</h3>
              <Link
                className="icon-btn"
                href="/tools/timestamp"
                aria-label={t("打开时间戳转换")}
              >
                <Icon name="diagonal" />
              </Link>
            </div>
            <div className="timestamp-display">
              {Math.floor(now.getTime() / 1000)}
            </div>
            <p className="timestamp-caption">{t("当前 Unix 时间戳 · 秒")}</p>
            <div className="timestamp-arrow">
              <Icon name="down" />
            </div>
            <div className="timestamp-date">
              {formatLocal(now).replace("T", " ")}
            </div>
            <div className="feature-bottom">
              <span>Asia/Shanghai</span>
              <Link className="text-btn" href="/tools/timestamp">
                {t("转换时间")}
                <Icon name="right" />
              </Link>
            </div>
          </Card>
        </div>
      </section>
      <section id="all-tools">
        <div className="section-heading all-heading">
          <div className="section-title">
            <h2>{t(title)}</h2>
            <span>{String(displayed.length).padStart(2, "0")}</span>
          </div>
          <div className="filter-pills" aria-label={t("工具分类")}>
            {Object.entries({
              all: "全部",
              time: "时间日期",
              convert: "换算计算",
              text: "文本开发",
            }).map(([key, name]) => (
              <Link
                key={key}
                className={`filter-pill ${active === key ? "active" : ""}`}
                aria-current={active === key ? "page" : undefined}
                href={key === "all" ? "/" : `/?filter=${key}`}
              >
                {t(name)}
              </Link>
            ))}
          </div>
        </div>
        <div className="tools-grid">
          {displayed.length ? (
            displayed.map((tool) => <ToolCard key={tool.id} tool={tool} />)
          ) : (
            <div className="empty-state">
              <Icon name={active === "recent" ? "history" : "search"} />
              <h3>
                {t(
                  active === "recent"
                    ? "还没有最近使用的工具"
                    : active === "favorites" && !query
                      ? "收藏你的常用工具"
                      : "没有找到相关工具",
                )}
              </h3>
              <p>
                {t(
                  active === "recent"
                    ? "打开一个工具，就会出现在这里。"
                    : "点击工具卡片上的星标，或试试其他关键词。",
                )}
              </p>
            </div>
          )}
        </div>
      </section>
      <div className="bottom-note">
        <span className="green-dot" />
        {t("即开即用，让每一次操作都简单一点。")}
      </div>
    </>
  );
}
