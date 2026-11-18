import type { AgentCitation } from "../agent-media.ts";

export function collectAgentCitations(
  parts: { text: string; annotations?: unknown }[],
): AgentCitation[] {
  const citations: AgentCitation[] = [];
  let offset = 0;
  for (const { text, annotations } of parts) {
    const length = Array.from(text).length;
    if (Array.isArray(annotations)) {
      for (const annotation of annotations) {
        if (
          annotation?.type !== "url_citation" ||
          typeof annotation.url !== "string" ||
          !Number.isInteger(annotation.end_index) ||
          annotation.end_index < 0 ||
          annotation.end_index > length
        )
          continue;
        const url = URL.parse(annotation.url);
        if (!url || !["https:", "http:"].includes(url.protocol)) continue;
        citations.push({
          end: offset + annotation.end_index,
          url: url.href,
          title:
            typeof annotation.title === "string" && annotation.title
              ? annotation.title
              : url.hostname,
        });
      }
    }
    offset += length;
  }
  return citations;
}
