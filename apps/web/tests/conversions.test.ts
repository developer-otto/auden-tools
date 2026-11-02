import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePages,
  validateFiles,
  validateOptions,
  conversionSpecs,
} from "../lib/conversions.ts";

test("page selections preserve order and reject absent, reversed or excessive pages", () => {
  assert.deepEqual(parsePages("3,1-2,3，5", 5), [2, 0, 1, 4]);
  for (const value of ["", "0", "6", "3-1", "1,", "1.5", "1;2"])
    assert.throws(() => parsePages(value, 5));
  assert.throws(() => parsePages("1", 501));
});

test("browser limits reject legacy Word, oversized inputs, totals and unsupported output codecs", () => {
  assert.throws(() =>
    validateFiles("word-pdf", [{ name: "letter.doc", size: 100 }]),
  );
  assert.doesNotThrow(() =>
    validateFiles("word-pdf", [{ name: "信件.DOCX", size: 100 }]),
  );
  const maximum = conversionSpecs["video-mp4"].maxFileBytes;
  assert.doesNotThrow(() =>
    validateFiles("video-mp4", [{ name: "clip.mov", size: maximum }]),
  );
  assert.throws(() =>
    validateFiles("video-mp4", [{ name: "clip.mov", size: maximum + 1 }]),
  );
  assert.throws(() =>
    validateFiles(
      "pdf-merge",
      Array.from({ length: 3 }, () => ({
        name: "file.pdf",
        size: 20 * 1024 * 1024,
      })),
    ),
  );
  assert.throws(() => validateOptions({ imageFormat: "avif" }));
  assert.throws(() => validateOptions({ quality: NaN }));
  assert.equal(validateOptions({ quality: 100 }).quality, 100);
});
