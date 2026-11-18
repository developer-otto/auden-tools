export const maxAgentAttachmentBytes = 2 * 1024 * 1024;
export const maxAgentRequestBytes = 32_768;
export const maxAttachedAgentRequestBytes =
  Math.ceil(maxAgentAttachmentBytes / 3) * 4 + maxAgentRequestBytes;

export const agentAttachmentTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
type AgentAttachmentType = (typeof agentAttachmentTypes)[number];

export type AgentAttachment = {
  mime: AgentAttachmentType;
  name: string;
  data: string;
};

export function isAgentAttachmentType(
  value: unknown,
): value is AgentAttachmentType {
  return (
    typeof value === "string" &&
    agentAttachmentTypes.some((type) => type === value)
  );
}

export function encodeAgentAttachment(file: File): Promise<AgentAttachment> {
  const mime = file.type;
  if (
    !isAgentAttachmentType(mime) ||
    !file.size ||
    file.size > maxAgentAttachmentBytes
  )
    return Promise.reject(new Error("Unsupported attachment"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const data = String(reader.result).split(",", 2)[1];
      if (!data) {
        reject(new Error("Missing attachment data"));
        return;
      }
      const name =
        file.name
          .replace(/[\x00-\x1F\x7F]/g, "")
          .trim()
          .slice(0, 180) || "attachment";
      resolve({ mime, name, data });
    };
    reader.readAsDataURL(file);
  });
}
