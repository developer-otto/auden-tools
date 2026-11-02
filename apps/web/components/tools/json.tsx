"use client";
import { useState } from "react";
import { formatJson } from "../../lib/json";
import { Icon } from "../icon";
import { useApp } from "../providers";
import { DetailHeader } from "../shared";

export default function JsonTool() {
  const { t, copy, notify } = useApp();
  const [value, setValue] = useState(() =>
    JSON.stringify(
      {
        name: "Auden Tools",
        description: t("让日常，简单一点。"),
        tools: ["time", "currency", "text"],
        simple: true,
      },
      null,
      2,
    ),
  );
  const [indent, setIndent] = useState<2 | 4>(2),
    [error, setError] = useState(""),
    [validated, setValidated] = useState(true);
  const process = (action: "format" | "minify" | "validate") => {
    try {
      if (action === "validate") JSON.parse(value);
      else setValue(formatJson(value, action === "minify" ? 0 : indent));
      setValidated(true);
      setError("");
      notify(action === "validate" ? "JSON 校验通过" : "JSON 已处理");
    } catch (exception) {
      setValidated(false);
      setError((exception as Error).message);
    }
  };
  return (
    <>
      <DetailHeader id="json" description="让结构一目了然，让数据清晰可读。" />
      <section className="panel">
        <div className="panel-heading">
          <h2>{t("JSON 编辑器")}</h2>
          <div className="inline-actions">
            <select
              name="json-indent"
              className="field compact-field"
              aria-label={t("缩进")}
              value={indent}
              onChange={(event) =>
                setIndent(event.target.value === "4" ? 4 : 2)
              }
            >
              <option value="2">{t("2 空格")}</option>
              <option value="4">{t("4 空格")}</option>
            </select>
            <button className="button small" onClick={() => copy(value)}>
              <Icon name="copy" />
              {t("复制")}
            </button>
          </div>
        </div>
        <textarea
          name="json-content"
          className="text-area json-area"
          aria-label={t("JSON 内容")}
          spellCheck={false}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setValidated(false);
            setError("");
          }}
        />
        <div className="status-row">
          <span role="status" className={error ? "validation-error" : ""}>
            {error
              ? t("格式错误：{message}", { message: error })
              : t(validated ? "✓ 有效 JSON" : "尚未校验")}
          </span>
          <span>{t("输入内容仅在浏览器处理")}</span>
        </div>
        <div className="button-row">
          <button className="button primary" onClick={() => process("format")}>
            <Icon name="code" />
            {t("格式化")}
          </button>
          <button className="button" onClick={() => process("minify")}>
            {t("压缩")}
          </button>
          <button className="button" onClick={() => process("validate")}>
            {t("校验")}
          </button>
        </div>
        <p className="precision-note">
          {t("格式化保留大整数、长小数及原始数字精度。")}
        </p>
      </section>
    </>
  );
}
