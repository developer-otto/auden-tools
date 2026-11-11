import { expect, test, type Page } from "@playwright/test";

async function selectOption(
  page: Page,
  label: string,
  option: string | RegExp,
) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page
    .getByRole("option", { name: option, exact: typeof option === "string" })
    .click();
}

test("monthly calendar connects public holidays to lunar and Julian day details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tools/date");
  await selectOption(page, "年份", "2026");
  await selectOption(page, "月份", "二月");
  const newYear = page.locator('[data-day="2026-02-17"] button');
  await expect(newYear).toHaveAccessibleName(/公共节日/);
  await newYear.click();
  await expect(page.getByText("丙午年正月初一", { exact: true })).toBeVisible();
  await expect(page.getByText("2026-02-04", { exact: true })).toBeVisible();
  const japaneseHoliday = page.getByRole("button", {
    name: /02-11.*建国記念の日/,
  });
  await expect(japaneseHoliday).toBeVisible();
  await page.getByRole("button", { name: "日本", exact: true }).click();
  await expect(japaneseHoliday).toBeHidden();
  await expect(newYear).toHaveAccessibleName(/公共节日/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("region time changes show exact offsets and mark the local transition day", async ({
  page,
}) => {
  await page.goto("/tools/date");
  await selectOption(page, "年份", "2026");
  await selectOption(page, "时区地区", /America\/New_York/);
  const spring = page.getByRole("row", { name: /进入夏令时/ });
  await expect(spring).toContainText("2026-03-08 02:00:00");
  await expect(spring).toContainText("2026-03-08 03:00:00");
  await expect(spring).toContainText("EST · UTC-05:00");
  await expect(spring).toContainText("EDT · UTC-04:00");
  await spring.getByRole("button").click();
  await expect(
    page.locator('[data-day="2026-03-08"] button'),
  ).toHaveAccessibleName(/时钟切换/);
  await expect(
    page.getByRole("link", { name: "当天有时钟切换，查看详情" }),
  ).toBeVisible();
  await selectOption(page, "时区地区", /Asia\/Shanghai/);
  await expect(page.getByText("2026 年该时区没有时钟切换。")).toBeVisible();
});
