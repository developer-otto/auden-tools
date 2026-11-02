"use client";
import { useState } from "react";
import { Icon } from "../icon";
import { useApp } from "../providers";
import { DetailHeader, Notice } from "../shared";

export default function TextTool() {
  const { t, locale, copy, notify } = useApp();
  const [value, setValue] = useState(() =>
    [
      t("让日常，简单一点。"),
      t("把时间留给更重要的事。"),
      t("让日常，简单一点。"),
      "",
      "Auden Tools — your everyday toolkit.",
    ].join("\n"),
  );
  const actions = {
    dedupe: "按行去重",
    empty: "去除空行",
    trim: "清理首尾空格",
    sort: "按行排序",
    upper: "转为大写",
    lower: "转为小写",
  };
  const process = (action: keyof typeof actions) => {
    const lines = value.split(/\r?\n/);
    const operations = {
      dedupe: () => [...new Set(lines)].join("\n"),
      empty: () => lines.filter((line) => line.trim()).join("\n"),
      trim: () =>
        lines
          .map((line) => line.trim())
          .join("\n")
          .trim(),
      sort: () =>
        [...lines].sort((a, b) => a.localeCompare(b, locale)).join("\n"),
      upper: () => value.toLocaleUpperCase(locale),
      lower: () => value.toLocaleLowerCase(locale),
    };
    setValue(operations[action]());
    notify("文本已处理");
  };
  return (
    <>
      <DetailHeader id="text" description="把文字整理好，让思路更清晰。" />
      <section className="panel">
        <div className="panel-heading">
          <h2>{t("文本工作区")}</h2>
          <button className="button small" onClick={() => copy(value)}>
            <Icon name="copy" />
            {t("复制文本")}
          </button>
        </div>
        <textarea
          name="text-content"
          className="text-area"
          aria-label={t("待处理文本")}
          placeholder={t("在这里粘贴或输入文本…")}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="status-row">
          <span>
            {t("{characters} 字符 · {lines} 行 · {han} 个汉字", {
              characters: [...value].length,
              lines: value ? value.split(/\r?\n/).length : 0,
              han: value.match(/\p{Script=Han}/gu)?.length || 0,
            })}
          </span>
          <span>{t("即时统计")}</span>
        </div>
        <div className="button-row wrapping">
          {Object.entries(actions).map(([id, name], index) => (
            <button
              key={id}
              className={`button ${index === 0 ? "primary" : ""}`}
              onClick={() => process(id as keyof typeof actions)}
            >
              {t(name)}
            </button>
          ))}
        </div>
        <Notice>
          {t("文本仅在当前浏览器处理。请按需要复制保存处理结果。")}
        </Notice>
      </section>
    </>
  );
}
