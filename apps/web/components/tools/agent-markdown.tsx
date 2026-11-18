import type { Element, Root } from "hast";
import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentCitation } from "../../lib/agent-media";

const markdownPlugins = [remarkGfm];
const blockedElements = ["img"];
const citationBlocks = /^(p|li|th|td|h[1-6])$/;

function safeLink(value: string) {
  const url = URL.parse(value);
  return url?.protocol === "https:" || url?.protocol === "http:"
    ? url.href
    : undefined;
}

const components: Components = {
  a({ href, children, className, title, "aria-label": label }) {
    if (!href) return <>{children}</>;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={title}
        aria-label={label}
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="agents-markdown-table">
        <table>{children}</table>
      </div>
    );
  },
};

function addCitations(content: string, citations: AgentCitation[]) {
  return () => (tree: Root) => {
    const blocks: Element[] = [];
    function collect(parent: Root | Element) {
      for (const child of parent.children) {
        if (child.type !== "element") continue;
        if (citationBlocks.test(child.tagName)) blocks.push(child);
        collect(child);
      }
    }
    collect(tree);

    // OpenAI counts Unicode code points. Syntax tree offsets use UTF-16.
    const characters = Array.from(content);
    citations
      .toSorted((a, b) => a.end - b.end)
      .forEach(({ end, url, title }, index) => {
        const href = safeLink(url);
        if (!href) return;
        const offset = characters.slice(0, end).join("").length;
        const block = blocks.findLast(({ position }) => {
          const start = position?.start.offset;
          const finish = position?.end.offset;
          return (
            start !== undefined &&
            finish !== undefined &&
            start <= offset &&
            offset <= finish
          );
        });
        (block ?? tree).children.push({
          type: "element",
          tagName: "a",
          properties: {
            href,
            title,
            ariaLabel: title,
            className: ["agents-citation"],
          },
          children: [{ type: "text", value: `[${index + 1}]` }],
        });
      });
  };
}

export const AgentMarkdown = memo(function AgentMarkdown({
  content,
  citations,
}: {
  content: string;
  citations?: AgentCitation[];
}) {
  return (
    <div className="agents-message-text agents-markdown">
      <Markdown
        skipHtml
        disallowedElements={blockedElements}
        components={components}
        remarkPlugins={markdownPlugins}
        rehypePlugins={
          citations?.length ? [addCitations(content, citations)] : undefined
        }
        urlTransform={safeLink}
      >
        {content}
      </Markdown>
    </div>
  );
});
