import { expect, test } from "@playwright/test";

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

test("Agents remembers the key and opens configuration only for setup or a new chat", async ({
  page,
}) => {
  const calls: [string, string | undefined][] = [];
  await page.route("**/api/agents", async (route) => {
    expect(route.request().headers()["x-agents-access-code"]).toBe(
      "browser-test-code",
    );
    const { type, effort } = route.request().postDataJSON();
    calls.push([type, effort]);
    await route.fulfill({ json: { text: "Example answer" } });
  });
  await page.goto("/tools/agents");
  await page.getByRole("button", { name: "会话设置" }).click();
  const modal = page.getByRole("dialog", { name: "会话设置" });
  await modal.getByLabel("访问码").fill("browser-test-code");
  await modal.getByRole("button", { name: "进入聊天" }).click();
  const message = page.getByRole("textbox", { name: "输入消息" });
  await expect(message).toBeVisible();
  await expect(modal).toBeHidden();
  expect(calls).toEqual([]);
  await message.fill("Hello");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(page.getByText("Example answer")).toBeVisible();
  expect(calls).toEqual([["chat", undefined]]);

  await page.getByRole("button", { name: "新对话" }).click();
  await expect(modal.getByLabel("访问码")).toHaveCount(0);
  await modal.getByRole("combobox", { name: "会话类型" }).click();
  await page.getByRole("option", { name: "编程助手" }).click();
  await modal.getByRole("combobox", { name: "Reasoning" }).click();
  await page.getByRole("option", { name: "高", exact: true }).click();
  await modal.getByRole("button", { name: "进入聊天" }).click();
  await expect(page.getByText("Example answer")).toHaveCount(0);
  await page.reload();
  await expect(message).toBeVisible();
  await expect(modal).toBeHidden();
  await message.fill("Explain code");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(page.getByText("Example answer")).toBeVisible();
  expect(calls).toEqual([
    ["chat", undefined],
    ["coding", "high"],
  ]);

  await page.getByRole("button", { name: "清除访问码" }).click();
  await expect(modal.getByLabel("访问码")).toHaveValue("");
  await expect(message).toHaveCount(0);
  await page.reload();
  await expect(message).toHaveCount(0);
});

test.describe("Agent tools", () => {
  test("dictates without sending, shows inline web citations, and plays audio on demand", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["microphone"]);
    let messages = 0;
    await page.route("**/api/agents/transcribe", async (route) => {
      expect(route.request().headers()["content-type"]).toContain("audio/");
      expect(route.request().postDataBuffer()?.length).toBeGreaterThan(0);
      await route.fulfill({ json: { text: "Search for a source" } });
    });
    await page.route("**/api/agents", async (route) => {
      messages++;
      expect(route.request().postDataJSON()).toMatchObject({
        webSearch: true,
        turns: [{ role: "user", content: "Search for a source" }],
      });
      await route.fulfill({
        json: {
          text: "Search result.",
          citations: [
            {
              end: 13,
              title: "Example source",
              url: "https://example.test/source",
            },
          ],
        },
      });
    });
    await page.route("**/api/agents/speech", async (route) => {
      expect(route.request().postData()).toBe("Search result.");
      await route.fulfill({ contentType: "audio/mpeg", body: "mock audio" });
    });
    await page.goto("/tools/agents");
    await page.getByRole("button", { name: "会话设置" }).click();
    await page.getByLabel("访问码").fill("browser-test-code");
    await page.getByRole("button", { name: "联网搜索" }).click();
    await page.getByRole("button", { name: "进入聊天" }).click();
    await page.getByRole("button", { name: "语音输入" }).click();
    await page.getByRole("button", { name: "停止并转文字" }).click();
    await expect(page.getByRole("textbox", { name: "输入消息" })).toHaveValue(
      "Search for a source",
    );
    expect(messages).toBe(0);
    await page.getByRole("button", { name: "发送消息" }).click();
    await expect(
      page.getByRole("link", { name: "Example source" }),
    ).toHaveAttribute("href", "https://example.test/source");
    await page.getByRole("button", { name: "AI 朗读" }).click();
    await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
    await expect(
      page.getByText("AI 生成的朗读语音", { exact: true }),
    ).toBeVisible();
  });
});

test("chat settings apply to the next message without resetting the conversation", async ({
  page,
}) => {
  const calls: unknown[] = [];
  await page.route("**/api/agents", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({
      json: { text: calls.length === 1 ? "First reply" : "Second reply" },
    });
  });
  await page.goto("/tools/agents");
  await page.getByRole("button", { name: "会话设置" }).click();
  const modal = page.getByRole("dialog", { name: "会话设置" });
  await modal.getByLabel("访问码").fill("browser-test-code");
  await modal.getByRole("button", { name: "进入聊天" }).click();

  const message = page.getByRole("textbox", { name: "输入消息" });
  await message.fill("First question");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(page.getByText("First reply", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "会话设置" }).click();
  await expect(modal.getByLabel("访问码")).toHaveCount(0);
  await modal.getByRole("combobox", { name: "会话类型" }).click();
  await page.getByRole("option", { name: "编程助手" }).click();
  await modal.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByText("First reply", { exact: true })).toBeVisible();
  await message.fill("Second question");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(page.getByText("Second reply", { exact: true })).toBeVisible();
  expect(calls[1]).toMatchObject({
    type: "coding",
    turns: [
      { role: "user", content: "First question" },
      { role: "assistant", content: "First reply" },
      { role: "user", content: "Second question" },
    ],
  });
});

test("Agents restores, continues, and deletes local conversations", async ({ page }) => {
  const requests: unknown[] = [];
  await page.route("**/api/agents", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { text: `Reply ${requests.length}` } });
  });
  await page.goto("/tools/agents");
  await page.getByRole("button", { name: "会话设置" }).click();
  const modal = page.getByRole("dialog", { name: "会话设置" });
  await modal.getByLabel("访问码").fill("browser-test-code");
  await modal.getByRole("button", { name: "进入聊天" }).click();
  const input = page.getByRole("textbox", { name: "输入消息" });
  const send = page.getByRole("button", { name: "发送消息" });
  await input.fill("First conversation");
  await send.click();
  await expect(page.getByText("Reply 1")).toBeVisible();
  await page.getByRole("button", { name: "新对话" }).click();
  await modal.getByRole("button", { name: "进入聊天" }).click();
  await input.fill("Second conversation");
  await send.click();
  await expect(page.getByText("Reply 2")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Reply 2")).toBeVisible();
  const picker = page.getByRole("combobox", { name: "本机会话" });
  await picker.click();
  await page.getByRole("option", { name: "First conversation" }).click();
  await expect(page.getByText("Reply 1")).toBeVisible();
  await input.fill("Follow-up");
  await send.click();
  await expect(page.getByText("Reply 3")).toBeVisible();
  expect(requests[2]).toMatchObject({
    turns: [
      { role: "user", content: "First conversation" },
      { role: "assistant", content: "Reply 1" },
      { role: "user", content: "Follow-up" },
    ],
  });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除会话" }).click();
  await page.reload();
  await expect(page.getByText("Reply 2")).toBeVisible();
  await picker.click();
  await expect(page.getByRole("option", { name: "First conversation" })).toHaveCount(0);
});

test("Agents renders Markdown from new and cached replies without active HTML", async ({
  page,
}) => {
  const reply = [
    "我可以帮你：",
    "",
    "- **解答问题**：解释概念",
    "- **编程协助**：讲解实现思路",
    "",
    "```html",
    "<script>example()</script>",
    "```",
    "",
    "[参考资料](https://example.test/doc)",
    "[无效链接](jAvAsCrIpT:example())",
    "[数据链接](data:text/html,example)",
    "![外部图片](https://example.test/pixel.png)",
    "",
    "<script>example()</script>",
    '<button onclick="example()">无效按钮</button>',
  ].join("\n");
  await page.route("**/api/agents", (route) =>
    route.fulfill({ json: { text: reply } }),
  );
  await page.goto("/tools/agents");
  await page.getByRole("button", { name: "会话设置" }).click();
  await page.getByLabel("访问码").fill("browser-test-code");
  await page.getByRole("button", { name: "进入聊天" }).click();
  await page.getByRole("textbox", { name: "输入消息" }).fill("**原始输入**");
  await page.getByRole("button", { name: "发送消息" }).click();
  const answer = page.locator("article[data-role=assistant] .agents-markdown");
  await expect(answer.getByRole("listitem")).toHaveCount(2);
  await page.reload();
  await expect(answer.getByRole("listitem")).toHaveCount(2);
  await expect(answer.locator("li strong").first()).toHaveText("解答问题");
  await expect(answer.locator("pre code")).toHaveText(
    "<script>example()</script>",
  );
  await expect(answer.getByRole("link", { name: "参考资料" })).toHaveAttribute(
    "href",
    "https://example.test/doc",
  );
  await expect(answer.getByRole("link")).toHaveCount(1);
  await expect(answer.getByText("无效链接")).toBeVisible();
  await expect(answer.getByText("数据链接")).toBeVisible();
  await expect(answer.locator("script, [onclick], button, img")).toHaveCount(0);
  await expect(
    page.getByRole("log").getByText("**原始输入**", { exact: true }),
  ).toBeVisible();
});

test("auto routing restores the specialist reply and site tools setting", async ({ page }) => {
  await page.route("**/api/agents", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      type: "auto",
      siteTools: true,
    });
    await route.fulfill({
      json: { text: "ここに翻訳があります。", responder: "translation" },
    });
  });
  await page.goto("/tools/agents");
  await page.getByRole("button", { name: "会话设置" }).click();
  const modal = page.getByRole("dialog", { name: "会话设置" });
  await modal.getByLabel("访问码").fill("browser-test-code");
  await modal.getByRole("combobox", { name: "会话类型" }).click();
  await page.getByRole("option", { name: "自动分流" }).click();
  const tools = modal.getByRole("button", { name: "站内工具" });
  await expect(tools).toHaveAttribute("aria-pressed", "false");
  await tools.click();
  await modal.getByRole("button", { name: "进入聊天" }).click();
  await page.getByRole("textbox", { name: "输入消息" }).fill("请翻译成日文");
  await page.getByRole("button", { name: "发送消息" }).click();

  const reply = page.locator("article[data-role=assistant]");
  await expect(reply.getByText("ここに翻訳があります。")).toBeVisible();
  await page.reload();
  await expect(reply.getByText("翻译", { exact: true })).toBeVisible();
  await expect(reply.getByText("ここに翻訳があります。")).toBeVisible();
  await page.getByRole("button", { name: "会话设置" }).click();
  await expect(tools).toHaveAttribute("aria-pressed", "true");
});
