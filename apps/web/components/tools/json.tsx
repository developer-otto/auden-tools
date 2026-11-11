"use client";
import { Card } from "../ui/card";
import { Select, SelectItem } from "../ui/select";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
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
      <Card as="section">
        <div className="panel-heading">
          <h2>{t("JSON 编辑器")}</h2>
          <div className="inline-actions">
            <Select
              name="json-indent"
              className="field compact-field"
              aria-label={t("缩进")}
              value={indent}
              onValueChange={(value) => setIndent(value === "4" ? 4 : 2)}
            >
              <SelectItem value="2">{t("2 空格")}</SelectItem>
              <SelectItem value="4">{t("4 空格")}</SelectItem>
            </Select>
            <Button className="button small" onClick={() => copy(value)}>
              <Icon name="copy" />
              {t("复制")}
            </Button>
          </div>
        </div>
        <Textarea
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
          <Button className="button primary" onClick={() => process("format")}>
            <Icon name="code" />
            {t("格式化")}
          </Button>
          <Button className="button" onClick={() => process("minify")}>
            {t("压缩")}
          </Button>
          <Button className="button" onClick={() => process("validate")}>
            {t("校验")}
          </Button>
        </div>
        <p className="precision-note">
          {t("格式化保留大整数、长小数及原始数字精度。")}
        </p>
      </Card>
    </>
  );
}
