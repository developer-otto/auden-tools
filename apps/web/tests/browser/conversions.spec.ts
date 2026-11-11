import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);
const uploads = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const sent: string[] = [];
  uploads.set(page, sent);
  page.context().on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) sent.push(request.url());
  });
  // Any file-upload request is a regression; all conversion tests run without it.
  await page.route("**/api/conversions**", () => {
    throw new Error("Unexpected conversion API request");
  });
});
test.afterEach(async ({ page }) => {
  expect(
    uploads.get(page),
    "Conversions must not upload any files or task data",
  ).toEqual([]);
});
async function convert(page: Page) {
  await page.getByRole("button", { name: "开始转换", exact: true }).click();
  await expect(page.locator(".conversion-job").first()).not.toHaveClass(
    /running/,
    { timeout: 90_000 },
  );
  expect(
    await page.locator(".conversion-job").first().getAttribute("class"),
    await page.locator(".conversion-job").first().innerText(),
  ).toContain("succeeded");
  const link = page.getByRole("link", { name: "下载", exact: true }).first();
  expect(await link.getAttribute("href")).toMatch(/^blob:/);
  return Buffer.from(
    await link.evaluate(async (element: HTMLAnchorElement) =>
      Array.from(
        new Uint8Array(await (await fetch(element.href)).arrayBuffer()),
      ),
    ),
  );
}
async function pdf(widths: number[]) {
  const doc = await PDFDocument.create();
  widths.forEach((width) => doc.addPage([width, 200]));
  return Buffer.from(await doc.save());
}

test("image conversion downloads a real JPEG locally and releases removed results", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });
  await page.goto("/tools/image");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "透明.png", mimeType: "image/png", buffer: png });
  await page.getByRole("radio", { name: "JPG", exact: true }).click();
  const bytes = await convert(page);
  expect([...bytes.subarray(0, 2)]).toEqual([255, 216]);
  const url = await page
    .getByRole("link", { name: "下载", exact: true })
    .getAttribute("href");
  await page.getByRole("button", { name: "删除文件", exact: true }).click();
  await expect(page.locator(".conversion-job")).toHaveCount(0);
  expect(
    await page.evaluate(async (url) => {
      try {
        await fetch(url!);
        return false;
      } catch {
        return true;
      }
    }, url),
  ).toBe(true);
  expect(requests).toEqual([]);
});

test("PDF merge honors file ordering and downloads all pages", async ({
  page,
}) => {
  await page.goto("/tools/pdf-merge");
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "first.pdf",
      mimeType: "application/pdf",
      buffer: await pdf([101, 102]),
    },
    {
      name: "second.pdf",
      mimeType: "application/pdf",
      buffer: await pdf([201]),
    },
  ]);
  await page
    .getByRole("button", { name: "上移文件：second.pdf", exact: true })
    .click();
  const doc = await PDFDocument.load(await convert(page));
  expect(doc.getPages().map((page) => page.getWidth())).toEqual([
    201, 101, 102,
  ]);
  await page.reload();
  await expect(page.locator(".conversion-job")).toHaveCount(0);
});

test("PDF extraction validates actual page count, supports retry and preserves entered order", async ({
  page,
}) => {
  await page.goto("/tools/pdf-split");
  await page.locator('input[type="file"]').setInputFiles({
    name: "pages.pdf",
    mimeType: "application/pdf",
    buffer: await pdf([101, 102, 103]),
  });
  await page.locator("#pdf-pages").fill("4");
  await page.getByRole("button", { name: "开始转换", exact: true }).click();
  await expect(page.locator(".conversion-job")).toHaveClass(/failed/);
  await expect(page.locator(".conversion-job")).toContainText("页码无效");
  await page.locator("#pdf-pages").fill("3,1,3");
  const result = await PDFDocument.load(await convert(page));
  expect(result.getPages().map((page) => page.getWidth())).toEqual([103, 101]);
});

test("images become one PDF page per input", async ({ page }) => {
  await page.goto("/tools/images-pdf");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: png },
    { name: "b.png", mimeType: "image/png", buffer: png },
  ]);
  const result = await PDFDocument.load(await convert(page));
  expect(result.getPageCount()).toBe(2);
  expect(result.getPages()[0]!.getWidth()).toBeCloseTo(595.28, 1);
});

test("DOCX converts to a rendered PDF without uploading or leaving an iframe", async ({
  page,
}, testInfo) => {
  await page.goto("/tools/word-pdf");
  await page
    .locator('input[type="file"]')
    .setInputFiles(fixture("letter.docx"));
  const result = await convert(page);
  expect((await PDFDocument.load(result)).getPageCount()).toBeGreaterThan(0);
  expect(result.byteLength).toBeGreaterThan(2000);
  await writeFile(testInfo.outputPath("letter.pdf"), result);
  await expect(
    page.locator('iframe[title="Local document rendering"]'),
  ).toHaveCount(0);
});

test("MOV converts locally to a playable MP4 and cancellation permits retry", async ({
  page,
}) => {
  await page.goto("/tools/video-mp4");
  await page.locator('input[type="file"]').setInputFiles(fixture("tiny.mov"));
  const launched = page.waitForEvent("worker");
  await page.getByRole("button", { name: "开始转换", exact: true }).click();
  const worker = await launched;
  const closed = new Promise<void>((resolve) =>
    worker.once("close", () => resolve()),
  );
  await page
    .locator(".file-submit")
    .getByRole("button", { name: "取消任务", exact: true })
    .click();
  await closed;
  await expect(page.locator(".conversion-job")).toHaveClass(/cancelled/);
  await page.getByRole("button", { name: "重试转换", exact: true }).click();
  await expect(page.locator(".conversion-job")).not.toHaveClass(/running/, {
    timeout: 90_000,
  });
  expect(
    await page.locator(".conversion-job").getAttribute("class"),
    await page.locator(".conversion-job").innerText(),
  ).toContain("succeeded");
  const details = await page
    .getByRole("link", { name: "下载", exact: true })
    .evaluate(async (link: HTMLAnchorElement) => {
      const video = document.createElement("video");
      video.src = link.href;
      try {
        return await new Promise<{ duration: number; width: number }>(
          (resolve, reject) => {
            video.onloadedmetadata = () =>
              resolve({ duration: video.duration, width: video.videoWidth });
            video.onerror = () => reject(new Error("Unplayable video"));
          },
        );
      } finally {
        video.removeAttribute("src");
        video.load();
      }
    });
  expect(details.width).toBe(160);
  expect(details.duration).toBeGreaterThan(0.5);
});

test("audio extraction produces a real WAV locally", async ({ page }) => {
  await page.goto("/tools/audio-extract");
  await page.locator('input[type="file"]').setInputFiles(fixture("tiny.mov"));
  await page.getByRole("combobox", { name: "音频格式" }).click();
  await page.getByRole("option", { name: "WAV · PCM 16-bit" }).click();
  const result = await convert(page);
  expect(result.subarray(0, 4).toString()).toBe("RIFF");
  expect(result.subarray(8, 12).toString()).toBe("WAVE");
  expect(result.byteLength).toBeGreaterThan(8000);
});

test("invalid and legacy files fail without starting a conversion", async ({
  page,
}) => {
  await page.goto("/tools/word-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "legacy.doc",
    mimeType: "application/msword",
    buffer: await readFile(fixture("letter.docx")),
  });
  await expect(
    page.getByRole("button", { name: "开始转换", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".validation-error")).toContainText(
    "文件格式不受支持",
  );
});

test("corrupt media is rejected even when the WASM probe returns its default exit code", async ({
  page,
}) => {
  await page.goto("/tools/video-mp4");
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.mov",
    mimeType: "video/quicktime",
    buffer: Buffer.from("This is not a video"),
  });
  await page.getByRole("button", { name: "开始转换", exact: true }).click();
  await expect(page.locator(".conversion-job")).toHaveClass(/failed/);
  await expect(page.locator(".conversion-job")).toContainText("文件无法读取");
  await expect(
    page.getByRole("link", { name: "下载", exact: true }),
  ).toHaveCount(0);
});
