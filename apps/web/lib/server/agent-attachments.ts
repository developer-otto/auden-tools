import {
  isAgentAttachmentType,
  maxAgentAttachmentBytes,
  type AgentAttachment,
} from "../agent-attachments.ts";

export function readAgentAttachment(value: unknown): AgentAttachment | null {
  if (!value || typeof value !== "object") return null;
  const { mime, name, data } = value as Partial<AgentAttachment>;
  if (
    !isAgentAttachmentType(mime) ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 180 ||
    /[\x00-\x1F\x7F]/.test(name) ||
    typeof data !== "string" ||
    data.length > Math.ceil(maxAgentAttachmentBytes / 3) * 4 ||
    data.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data)
  )
    return null;
  const bytes = Buffer.from(data, "base64");
  if (bytes.length > maxAgentAttachmentBytes) return null;

  const signature = {
    "application/pdf": () => bytes.subarray(0, 5).toString("ascii") === "%PDF-",
    "image/png": () =>
      bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
    "image/jpeg": () => bytes.subarray(0, 3).toString("hex") === "ffd8ff",
    "image/webp": () =>
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP",
  };
  return signature[mime]() ? { mime, name, data } : null;
}
