import { expect, test } from "@playwright/test";

test("market directory keeps rankings and stock quotes on the source website", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/?filter=markets");
  await page.getByRole("link", { name: "打开全球行情", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "全球行情", exact: true }),
  ).toBeVisible();

  const ranking = page.getByRole("link", { name: "查看美股市值榜" });
  await expect(ranking).toHaveAttribute(
    "href",
    "https://www.tradingview.com/markets/stocks-usa/market-movers-large-cap/",
  );
  await expect(ranking).toHaveAttribute("target", "_blank");
  await expect(
    page.getByRole("link", { name: /纳斯达克综合指数/ }),
  ).toHaveAttribute("href", /NASDAQ-IXIC/);
  await expect(
    page.getByRole("link", { name: /纳斯达克 100/ }),
  ).toHaveAttribute("href", /NASDAQ-NDX/);
  await expect(page.getByRole("link", { name: /三星电子/ })).toHaveAttribute(
    "href",
    /KRX-005930/,
  );
  await expect(page.locator(".market-widget-frame")).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("only the chosen official widget is loaded, inside a sandboxed frame", async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route(
    "https://www.tradingview-widget.com/embed-widget/**",
    (route) => {
      requests.push(new URL(route.request().url()).pathname);
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><p>Widget loaded</p>",
      });
    },
  );
  await page.goto("/tools/markets");
  const frame = page.locator("iframe.market-widget-frame");
  await expect(frame).toHaveCount(0);
  expect(requests).toEqual([]);

  await page
    .getByRole("button", { name: "股票与指数行情", exact: true })
    .click();
  await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
  await expect(frame).toHaveAttribute(
    "src",
    /^https:\/\/www\.tradingview-widget\.com\//,
  );
  await expect(frame.contentFrame().getByText("Widget loaded")).toBeVisible();
  expect(requests).toEqual(["/embed-widget/market-overview/"]);

  const crypto = page.getByRole("button", {
    name: "加密货币市值行情",
    exact: true,
  });
  await crypto.click();
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute("title", "加密货币市值行情");
  await expect(frame.contentFrame().getByText("Widget loaded")).toBeVisible();
  expect(requests).toEqual([
    "/embed-widget/market-overview/",
    "/embed-widget/crypto-mkt-screener/",
  ]);
  await crypto.click();
  await expect(frame).toHaveCount(0);
});
