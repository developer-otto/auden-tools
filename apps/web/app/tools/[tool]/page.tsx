import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { isLocale, translate } from "../../../lib/i18n";
import { getTool, isToolId } from "../../../lib/tools";
import { isConversionId } from "../../../lib/conversions";

const FileTool = dynamic(() => import("../../../components/tools/files"));

const screens = {
  markets: dynamic(() => import("../../../components/tools/markets")),
  timestamp: dynamic(() => import("../../../components/tools/timestamp")),
  world: dynamic(() => import("../../../components/tools/world")),
  currency: dynamic(() => import("../../../components/tools/currency")),
  date: dynamic(() => import("../../../components/tools/date")),
  units: dynamic(() => import("../../../components/tools/units")),
  text: dynamic(() => import("../../../components/tools/text")),
  json: dynamic(() => import("../../../components/tools/json")),
};
type Props = { params: Promise<{ tool: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool } = await params;
  if (!isToolId(tool)) return {};
  const saved = (await cookies()).get("auden-locale")?.value,
    locale = isLocale(saved) ? saved : "zh-CN";
  return {
    title: translate(locale, getTool(tool).name),
    description: translate(locale, getTool(tool).desc),
  };
}
export default async function ToolPage({ params }: Props) {
  const { tool } = await params;
  if (!isToolId(tool)) notFound();
  if (isConversionId(tool)) return <FileTool key={tool} operation={tool} />;
  const Screen = screens[tool];
  return <Screen />;
}
