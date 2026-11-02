import { add, divide, multiply, parse, round, subtract } from "./decimal.ts";
export type UnitGroup = "length" | "weight" | "temperature";
type Unit = { id: string; name: string; factor: string };
export const unitGroups: Record<UnitGroup, { name: string; units: Unit[] }> = {
  length: {
    name: "长度",
    units: [
      { id: "m", name: "米", factor: "1" },
      { id: "km", name: "千米", factor: "1000" },
      { id: "cm", name: "厘米", factor: "0.01" },
      { id: "ft", name: "英尺", factor: "0.3048" },
      { id: "in", name: "英寸", factor: "0.0254" },
    ],
  },
  weight: {
    name: "重量",
    units: [
      { id: "kg", name: "千克", factor: "1" },
      { id: "g", name: "克", factor: "0.001" },
      { id: "lb", name: "磅", factor: "0.45359237" },
      { id: "oz", name: "盎司", factor: "0.028349523125" },
    ],
  },
  temperature: {
    name: "温度",
    units: [
      { id: "c", name: "摄氏度", factor: "1" },
      { id: "f", name: "华氏度", factor: "1" },
      { id: "k", name: "开尔文", factor: "1" },
    ],
  },
};
export function convertUnit(
  value: string,
  group: UnitGroup,
  fromId: string,
  toId: string,
): string {
  const list = unitGroups[group].units,
    from = list.find((unit) => unit.id === fromId),
    to = list.find((unit) => unit.id === toId);
  if (!from || !to) throw new Error("Invalid unit");
  const amount = parse(value);
  if (group !== "temperature")
    return round(multiply(amount, divide(from.factor, to.factor)), 8);
  const c =
    from.id === "f"
      ? divide(subtract(amount, "32"), "1.8")
      : from.id === "k"
        ? subtract(amount, "273.15")
        : amount;
  const result =
    to.id === "f"
      ? add(multiply(c, "1.8"), "32")
      : to.id === "k"
        ? add(c, "273.15")
        : c;
  return round(result, 8);
}
