"use client";

import { useState } from "react";
import type { Locale } from "../../lib/i18n";
import {
  indexGroups,
  marketRanks,
  marketSymbolUrl,
  overviewTabs,
  stockGroups,
} from "../../lib/markets";
import { Icon } from "../icon";
import { useApp } from "../providers";
import { DetailHeader } from "../shared";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type Widget = "overview" | "crypto";
const localeCodes: Record<Locale, string> = {
  "zh-CN": "zh_CN",
  "zh-Hant": "zh_TW",
  en: "en",
  ja: "ja",
  ko: "kr",
};

function WidgetFrame({ kind }: { kind: Widget }) {
  const { locale, theme, t } = useApp();
  const overview = kind === "overview";
  const title = t(overview ? "股票与指数行情" : "加密货币市值行情");
  const widgetPath = overview ? "market-overview" : "crypto-mkt-screener";
  const config = {
    width: "100%",
    height: 500,
    colorTheme: theme,
    isTransparent: true,
    ...(overview
      ? {
          dateRange: "1M",
          showChart: false,
          showSymbolLogo: true,
          tabs: overviewTabs.map((tab) => ({
            title: t(tab.title),
            symbols: tab.symbols.map((symbol) => ({ s: symbol })),
          })),
        }
      : {
          defaultColumn: "overview",
          screener_type: "crypto_mkt",
          displayCurrency: "USD",
          market: "crypto",
          enableScrolling: true,
        }),
  };
  // Use the cross-origin frame emitted by TradingView's embed script.
  // This gives the widget its own storage origin without running its script in our page.
  const source = new URL(
    `https://www.tradingview-widget.com/embed-widget/${widgetPath}/`,
  );
  source.searchParams.set("locale", localeCodes[locale]);
  source.hash = encodeURIComponent(JSON.stringify(config));
  return (
    <figure className="market-widget">
      <iframe
        className="market-widget-frame"
        title={title}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        src={source.href}
      />
      <figcaption>
        <ExternalLink href={overview ? marketRanks.us : marketRanks.crypto}>
          TradingView
        </ExternalLink>
      </figcaption>
    </figure>
  );
}

function ExternalLink({
  href,
  children,
  className = "market-link",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <Icon name="diagonal" />
    </a>
  );
}

export default function MarketsTool() {
  const { t } = useApp();
  const [widget, setWidget] = useState<Widget | null>(null);
  const selectWidget = (next: Widget) =>
    setWidget((current) => (current === next ? null : next));

  return (
    <>
      <DetailHeader
        id="markets"
        description="查看主要指数、重点股票和加密货币行情。"
      />
      <div className="markets-layout">
        <Card as="section" className="panel market-overview-panel">
          <div className="panel-heading">
            <h2>{t("行情概览")}</h2>
            <Badge className="calendar-tag">TradingView</Badge>
          </div>
          <p className="muted market-note">
            {t("行情由 TradingView 提供，股票和指数可能延迟或仅提供收盘数据。")}
          </p>
          <p className="muted market-note">
            {t("选择下方按钮后，浏览器才会加载第三方行情组件。")}
          </p>
          <div className="market-actions">
            <Button
              className={`button${widget === "overview" ? " primary" : ""}`}
              aria-pressed={widget === "overview"}
              onClick={() => selectWidget("overview")}
            >
              <Icon name="chart" />
              {t("股票与指数行情")}
            </Button>
            <Button
              className={`button${widget === "crypto" ? " primary" : ""}`}
              aria-pressed={widget === "crypto"}
              onClick={() => selectWidget("crypto")}
            >
              <Icon name="chart" />
              {t("加密货币市值行情")}
            </Button>
          </div>
          {widget ? <WidgetFrame key={widget} kind={widget} /> : null}
        </Card>
        <Card as="section" className="panel market-rank-panel">
          <div className="panel-heading">
            <h2>{t("美股市值榜")}</h2>
          </div>
          <p className="muted market-note">
            {t(
              "在 TradingView 查看按市值排序的美股，前 50 名以来源页面为准。站内观察名单不代表排名。",
            )}
          </p>
          <ExternalLink className="button primary" href={marketRanks.us}>
            {t("查看美股市值榜")}
          </ExternalLink>
          <h3>{t("加密货币")}</h3>
          <p className="muted market-note">
            {t("按市值浏览币种，并查看美元价格和 24 小时涨跌幅。")}
          </p>
          <ExternalLink className="button" href={marketRanks.crypto}>
            {t("查看加密货币市值榜")}
          </ExternalLink>
        </Card>
      </div>

      <Card as="section" className="panel market-directory">
        <div className="panel-heading">
          <h2>{t("全球主要指数")}</h2>
        </div>
        <div className="market-index-grid">
          {indexGroups.map((group) => (
            <section key={group.name} className="market-group">
              <h3>
                <span aria-hidden="true">{group.flag}</span> {t(group.name)}
              </h3>
              <ul>
                {group.items.map(([name, symbol]) => (
                  <li key={symbol}>
                    <ExternalLink href={marketSymbolUrl(symbol)}>
                      <span>{t(name)}</span>
                      <code>{symbol.split(":")[1]}</code>
                    </ExternalLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Card>

      <Card as="section" className="panel market-directory">
        <div className="panel-heading">
          <h2>{t("港日韩重点个股")}</h2>
        </div>
        <p className="muted market-note">
          {t("以下是代表性个股。点击名称到 TradingView 查看行情、图表和详情。")}
        </p>
        <div className="market-stock-grid">
          {stockGroups.map((group) => (
            <section key={group.name} className="market-group">
              <h3>
                <span aria-hidden="true">{group.flag}</span> {t(group.name)}{" "}
                <Badge className="calendar-tag">{group.currency}</Badge>
              </h3>
              <ul>
                {group.items.map(([name, symbol]) => (
                  <li key={symbol}>
                    <ExternalLink href={marketSymbolUrl(symbol)}>
                      <span>{t(name)}</span>
                      <code>{symbol}</code>
                    </ExternalLink>
                  </li>
                ))}
              </ul>
              <ExternalLink className="button small" href={group.rank}>
                {t("查看该市场市值榜")}
              </ExternalLink>
            </section>
          ))}
        </div>
      </Card>
    </>
  );
}
