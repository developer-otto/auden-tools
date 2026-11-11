import { expect, test } from "@playwright/test";

test("quick search focuses its input and restores focus after Escape", async ({
  page,
}) => {
  await page.goto("/tools/date");
  const trigger = page.getByRole("button", { name: /快速查找/ });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "快速查找" });
  const input = dialog.getByRole("searchbox", { name: "搜索全部工具" });
  await expect(input).toBeFocused();
  await input.fill("JSON");
  await expect(dialog.getByRole("button", { name: /JSON/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("unit dropdown can select a category from the keyboard", async ({
  page,
}) => {
  await page.goto("/tools/units");
  const select = page.getByRole("combobox", { name: "换算类别" });
  await select.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("End");
  const option = page.getByRole("option").last();
  await expect(option).toBeFocused();
  const name = (await option.innerText()).trim();
  await page.keyboard.press("Enter");
  await expect(select).toContainText(name);
  await expect(select).toBeFocused();
});

test("image quality slider updates from the keyboard", async ({ page }) => {
  await page.goto("/tools/image");
  await page.getByRole("radio", { name: "JPG" }).click();
  const slider = page.getByRole("slider", { name: "图片质量" });
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "10");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "11");
});

test("usage help opens a notification", async ({ page }) => {
  await page.goto("/tools/date");
  await page.getByRole("button", { name: "使用说明" }).click();
  await expect(page.locator('[data-slot="toast"]')).toContainText(
    "日常计算在浏览器中完成",
  );
});

test("mobile navigation opens as a sheet and returns focus after closing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tools/date");
  const trigger = page.getByRole("button", { name: "打开导航" });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "主导航" });
  await expect(sheet.getByRole("navigation", { name: "主导航" })).toBeVisible();
  await sheet.getByRole("button", { name: "关闭" }).click();
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
});
