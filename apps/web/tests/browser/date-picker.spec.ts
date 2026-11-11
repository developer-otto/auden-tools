import { expect, test } from "@playwright/test";

test("selects a date and returns keyboard focus to the trigger", async ({
  page,
}) => {
  await page.goto("/tools/date");
  const start = page.locator("#date-start");

  const trigger = page.getByRole("button", { name: "打开日历" }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const calendar = page.getByRole("dialog", { name: "打开日历" });
  await expect(calendar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await start.fill("2024-02-01");
  await trigger.click();
  await calendar.locator('[data-day="2024-02-29"] button').click();
  await expect(start).toHaveValue("2024-02-29");
  await expect(calendar).toBeHidden();
});

test("keeps the time and milliseconds when selecting a date", async ({
  page,
}) => {
  await page.goto("/tools/timestamp");
  await page.getByRole("button", { name: "日期时间 → 时间戳" }).click();
  const date = page.getByRole("textbox", { name: "输入当地日期时间" });
  const time = page.locator('input[type="time"]');
  await date.fill("2024-02-01");
  await time.fill("12:34:56.789");
  await page.getByRole("button", { name: "打开日历" }).click();
  await page
    .getByRole("dialog", { name: "打开日历" })
    .locator('[data-day="2024-02-29"] button')
    .click();
  await expect(date).toHaveValue("2024-02-29");
  await expect(time).toHaveValue("12:34:56.789");
});
