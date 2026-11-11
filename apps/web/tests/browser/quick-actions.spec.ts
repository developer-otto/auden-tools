import { expect, test } from "@playwright/test";

test("dragging moves the floating button without opening it and changes the menu side", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await page.goto("/tools/json");
  const trigger = page.locator(".quick-actions-trigger");
  const menu = page.getByRole("dialog", { name: "快捷操作", exact: true });
  await trigger.click();
  await expect(menu).toHaveAttribute("data-side", "top");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  const box = (await trigger.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(32, 360, { steps: 8 });
  await page.mouse.up();
  await expect(menu).toBeHidden();
  const moved = (await trigger.boundingBox())!;
  expect(moved.x).toBeLessThan(24);

  await trigger.click();
  await expect(menu).toHaveAttribute("data-side", "right");
  await menu.getByRole("button", { name: "重置悬浮按钮位置" }).click();
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  const reset = (await trigger.boundingBox())!;
  expect(reset.x).toBeCloseTo(box.x);
  expect(reset.y).toBeCloseTo(box.y);
});

test("keyboard users can move the button and use search and favorites", async ({
  page,
}) => {
  await page.goto("/tools/json");
  const trigger = page.locator(".quick-actions-trigger");
  await trigger.focus();
  const initial = (await trigger.boundingBox())!;
  await page.keyboard.press("ArrowLeft");
  expect((await trigger.boundingBox())!.x).toBeLessThan(initial.x);
  await page.keyboard.press("Enter");
  const menu = page.getByRole("dialog", { name: "快捷操作", exact: true });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "收藏工具", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已收藏", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await trigger.click();
  await menu.getByRole("button", { name: "快速查找" }).click();
  const search = page.getByRole("dialog", { name: "快速查找", exact: true });
  await expect(search.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("list is the default and switching to fan persists on the same browser", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto("/tools/json");
  const trigger = page.locator(".quick-actions-trigger");
  const menu = page.getByRole("dialog", { name: "快捷操作", exact: true });
  await trigger.click();
  await expect(menu).toHaveAttribute("data-layout", "list");

  await menu.getByRole("button", { name: "切换为扇形菜单" }).click();
  await expect(menu).toHaveAttribute("data-layout", "fan");
  const search = menu.getByRole("button", { name: "快速查找" });
  await search.focus();
  await page.keyboard.press("ArrowRight");
  await expect(menu.getByRole("button", { name: "收藏工具" })).toBeFocused();
  for (const action of await menu.locator(".quick-action").all()) {
    const box = (await action.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(720);
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.reload();
  await trigger.click();
  await expect(menu).toHaveAttribute("data-layout", "fan");
  await menu.getByRole("button", { name: "切换为列表菜单" }).click();
  await expect(menu).toHaveAttribute("data-layout", "list");
});
