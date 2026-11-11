import { conversionIds } from "./conversions";

export const toolIds = [
  "timestamp",
  "world",
  "date",
  "currency",
  "units",
  "text",
  "json",
  ...conversionIds,
] as const;
export type ToolId = (typeof toolIds)[number];
export type Category = "time" | "convert" | "text" | "files";
export type Tool = {
  id: ToolId;
  name: string;
  desc: string;
  category: Category;
  label: string;
  icon: string;
  color: string;
  keywords: string;
};
export const tools: Tool[] = [
  {
    id: "image",
    name: "图片格式转换",
    desc: "转换常见图片格式，保留清晰细节。",
    category: "files",
    label: "FILES & MEDIA",
    icon: "image",
    color: "violet",
    keywords: "image 图片 JPG JPEG PNG WebP AVIF 格式 转换",
  },
  {
    id: "pdf-merge",
    name: "PDF 合并",
    desc: "按你需要的顺序，合为一份 PDF。",
    category: "files",
    label: "FILES & MEDIA",
    icon: "files",
    color: "rose",
    keywords: "pdf merge 合并 文档",
  },
  {
    id: "pdf-split",
    name: "PDF 拆分",
    desc: "选择需要的页码，提取为新的 PDF。",
    category: "files",
    label: "FILES & MEDIA",
    icon: "file",
    color: "amber",
    keywords: "pdf split 拆分 提取 页面",
  },
  {
    id: "images-pdf",
    name: "图片转 PDF",
    desc: "把照片与扫描件，整理成一份文档。",
    category: "files",
    label: "FILES & MEDIA",
    icon: "image",
    color: "",
    keywords: "image pdf 图片 文档 扫描",
  },
  {
    id: "word-pdf",
    name: "Word 转 PDF",
    desc: "将 Word 文档转为方便分享的 PDF。",
    category: "files",
    label: "FILES & MEDIA",
    icon: "file",
    color: "blue",
    keywords: "word doc docx pdf 文档 转换",
  },
  {
    id: "video-mp4",
    name: "视频转 MP4",
    desc: "转换 MOV 等视频，适配更多设备。",
    category: "files",
    label: "FILES & MEDIA",
    icon: "video",
    color: "violet",
    keywords: "video mov mp4 mkv webm 视频 转码",
  },
  {
    id: "audio-extract",
    name: "音频提取",
    desc: "保留视频中的声音，随时轻松聆听。",
    category: "files",
    label: "FILES & MEDIA",
    icon: "audio",
    color: "amber",
    keywords: "audio mp3 wav m4a 视频 声音 音频 提取",
  },
  {
    id: "timestamp",
    name: "时间戳转换",
    desc: "在时间戳与日期之间，轻松转换。",
    category: "time",
    label: "TIME & DATE",
    icon: "clock",
    color: "amber",
    keywords: "unix timestamp 时间转换 秒 毫秒",
  },
  {
    id: "world",
    name: "世界时间",
    desc: "连接每个时区，找到合适的时间。",
    category: "time",
    label: "TIME & DATE",
    icon: "globe",
    color: "",
    keywords: "timezone 时区 城市 世界时钟 会议",
  },
  {
    id: "date",
    name: "日期计算",
    desc: "计算日期间隔，安排每一个日程。",
    category: "time",
    label: "TIME & DATE",
    icon: "calendar",
    color: "blue",
    keywords:
      "日期差 天数 加减 倒计时 月历 农历 节日 夏令时 冬令时 儒略历 calendar holiday DST lunar Julian",
  },
  {
    id: "currency",
    name: "汇率换算",
    desc: "一个金额，多种货币，一目了然。",
    category: "convert",
    label: "CONVERT & CALCULATE",
    icon: "arrows",
    color: "",
    keywords: "汇率 多货币 外汇 美元 人民币 currency",
  },
  {
    id: "units",
    name: "单位换算",
    desc: "长度、重量、温度，换个单位就好。",
    category: "convert",
    label: "CONVERT & CALCULATE",
    icon: "ruler",
    color: "violet",
    keywords: "单位 长度 重量 温度 unit",
  },
  {
    id: "text",
    name: "文本工具",
    desc: "统计、去重、整理，让文字更清爽。",
    category: "text",
    label: "TEXT & DEVELOPMENT",
    icon: "text",
    color: "rose",
    keywords: "文本 字数 统计 去重 排序 空行",
  },
  {
    id: "json",
    name: "JSON 工具",
    desc: "格式化、校验，让数据清晰可读。",
    category: "text",
    label: "TEXT & DEVELOPMENT",
    icon: "code",
    color: "blue",
    keywords: "json 格式化 压缩 校验 开发",
  },
];
export function isToolId(value: string): value is ToolId {
  return toolIds.some((id) => id === value);
}
export function getTool(id: ToolId) {
  return tools.find((tool) => tool.id === id)!;
}
export const categories = {
  time: "时间与日期",
  convert: "换算与计算",
  text: "文本与开发",
  files: "文件与媒体",
} as const;
