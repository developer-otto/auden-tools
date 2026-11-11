import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/tools/date");
  // The solar terms appear after the browser has hydrated the controls.
  await expect(page.locator(".calendar-solar-terms button")).toHaveCount(2);
});

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

test("Qingming appears as both a solar term and a holiday", async ({
  page,
}) => {
  await selectOption(page, "年份", "2026");
  await selectOption(page, "月份", "四月");
  const day = page.locator('[data-day="2026-04-05"] button');
  await expect(day).toHaveAccessibleName(/公共节日.*清明/);
  const term = page.getByRole("button", { name: "04-05 清明", exact: true });
  await term.click();
  await expect(term).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("太阳黄经 15°", { exact: true })).toBeVisible();
});

test("Gregorian year view shows twelve consecutive months across December and January", async ({
  page,
}) => {
  await selectOption(page, "年份", "2026");
  await page.getByRole("radio", { name: "年视图" }).click();
  const yearGrid = page.locator(".calendar-year-grid");
  await expect(yearGrid.getByRole("grid")).toHaveCount(12);
  await expect(
    yearGrid.locator('[data-day="2026-01-01"] button'),
  ).toBeVisible();
  await expect(
    yearGrid.locator('[data-day="2026-12-31"] button'),
  ).toBeVisible();

  await selectOption(page, "起始月份", "十二月");
  await expect(yearGrid.getByRole("grid")).toHaveCount(12);
  await expect(page.getByText("2026-12-01", { exact: true })).toBeVisible();
  await expect(page.getByText("2027-11-30", { exact: true })).toBeVisible();
  const lastDay = yearGrid.locator('[data-day="2026-12-31"] button');
  const newYear = yearGrid.locator('[data-day="2027-01-01"] button');
  await expect(newYear).toHaveAccessibleName(/公共节日/);
  await expect(
    yearGrid.getByRole("button", { name: /2027年1月.*小寒/ }),
  ).toBeVisible();
  await lastDay.focus();
  await page.keyboard.press("ArrowRight");
  await expect(newYear).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".calendar-selected-date")).toContainText(
    "2027年1月1日",
  );
  await page.getByRole("radio", { name: "月视图" }).click();
  await expect(
    page.getByRole("combobox", { name: "年份", exact: true }),
  ).toContainText("2027");
  await expect(
    page.getByRole("combobox", { name: "月份", exact: true }),
  ).toContainText("一月");
});
