"use client";
import { Card } from "../ui/card";
import { Select, SelectItem } from "../ui/select";
import { Input } from "../ui/input";
import { useState } from "react";
import { format } from "../../lib/decimal";
import { convertUnit, unitGroups, type UnitGroup } from "../../lib/units";
import { Icon } from "../icon";
import { useApp } from "../providers";
import { CopyButton, DetailHeader } from "../shared";

export default function UnitsTool() {
  const { t, locale } = useApp(),
    [group, setGroup] = useState<UnitGroup>("length"),
    [value, setValue] = useState("100"),
    [from, setFrom] = useState("m"),
    [to, setTo] = useState("km");
  let result = "",
    error = "";
  try {
    result = convertUnit(value, group, from, to);
  } catch {
    error = t("请输入有效数值（最多 200 位数字）。");
  }
  const list = unitGroups[group].units;
  const changeGroup = (value: UnitGroup) => {
    setGroup(value);
    setFrom(unitGroups[value].units[0]!.id);
    setTo(unitGroups[value].units[1]!.id);
  };
  const help = {
    长度: ["1 英寸 = 2.54 厘米", "1 英尺 = 0.3048 米", "1 千米 = 1,000 米"],
    重量: ["1 磅 = 0.45359237 千克", "1 千克 = 1,000 克"],
    温度: ["华氏度 = 摄氏度 × 1.8 + 32", "开尔文 = 摄氏度 + 273.15"],
  };
  return (
    <>
      <DetailHeader
        id="units"
        description="熟悉的数值，不同的单位。换算变得简单。"
      />
      <div className="detail-columns">
        <Card as="section">
          <div className="panel-heading">
            <h2>{t("单位换算")}</h2>
            <Select
              name="unit-group"
              className="field compact-field"
              aria-label={t("换算类别")}
              value={group}
              onValueChange={(value) => changeGroup(value as UnitGroup)}
            >
              {Object.entries(unitGroups).map(([id, item]) => (
                <SelectItem key={id} value={id}>
                  {t(item.name)}
                </SelectItem>
              ))}
            </Select>
          </div>
          <label className="input-label" htmlFor="unit-value">
            {t("输入数值")}
          </label>
          <div className="input-row">
            <Input
              id="unit-value"
              className="field"
              inputMode="decimal"
              maxLength={220}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <Select
              name="unit-from"
              className="field"
              aria-label={t("原始单位")}
              value={from}
              onValueChange={(value) => setFrom(value)}
            >
              {list.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {t(unit.name)}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="field-group">
            <label className="input-label" htmlFor="unit-to">
              {t("转换为")}
            </label>
            <Select
              id="unit-to"
              className="field"
              value={to}
              onValueChange={(value) => setTo(value)}
            >
              {list.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {t(unit.name)}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="results-box">
            <div className="results-title">
              <span>{t("换算结果")}</span>
              <CopyButton value={result} disabled={!result} />
            </div>
            <div className="unit-result">
              {result
                ? `${format(result, locale, true)} ${t(list.find((unit) => unit.id === to)!.name)}`
                : "—"}
            </div>
            <p className="precision-note">
              {t("结果最多保留 8 位小数，仅在显示时四舍五入。")}
            </p>
          </div>
          {error ? (
            <p className="validation-error" role="alert">
              {error}
            </p>
          ) : null}
        </Card>
        <Card as="aside">
          <div className="panel-heading">
            <h2>{t("常用关系")}</h2>
            <Icon name="ruler" />
          </div>
          <div className="help-list">
            {Object.entries(help).map(([name, lines]) => (
              <div className="help-item" key={name}>
                <span>{t(name)}</span>
                <p>
                  {lines.map((line) => (
                    <span className="formula-line" key={line}>
                      {t(line)}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
