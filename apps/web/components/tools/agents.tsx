"use client";

import { useEffect, useRef, useState } from "react";
import {
  agentTypes,
  isAgentResponder,
  isAgentType,
  isReasoningEffort,
  reasoningEfforts,
  reasoningLabels,
  type ReasoningEffort,
  type AgentType,
  type AgentResponder,
} from "../../lib/agent-options";
import type { AgentCitation } from "../../lib/agent-media";
import { AgentDictation, AgentReadAloud } from "./agent-audio";
import { AgentMarkdown } from "./agent-markdown";
import { usePreference } from "../../lib/preferences";
import { Icon } from "../icon";
import { useApp } from "../providers";
import { DetailHeader } from "../shared";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem } from "../ui/select";
import { Textarea } from "../ui/textarea";

type Turn = {
  role: "user" | "assistant";
  content: string;
  citations?: AgentCitation[];
  responder?: AgentResponder;
};
const automaticModel = "automatic";
type Settings = {
  model: string;
  type: AgentType;
  effort?: ReasoningEffort;
  webSearch?: boolean;
  siteTools?: boolean;
};
const defaultSettings: Settings = { model: automaticModel, type: "chat" };
const validateAccess = (value: unknown) =>
  typeof value === "string" ? value : "";
function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return defaultSettings;
  const { model, type, effort, webSearch, siteTools } =
    value as Partial<Settings>;
  return {
    model: typeof model === "string" ? model : automaticModel,
    type: isAgentType(type) ? type : "chat",
    effort: isReasoningEffort(effort) ? effort : undefined,
    webSearch: webSearch === true,
    siteTools: siteTools === true,
  };
}

type SavedChat = { id: string; settings: Settings; turns: Turn[] };
type ChatHistory = { selected: string; chats: SavedChat[] };
const emptyHistory: ChatHistory = { selected: "", chats: [] };
const chatLimit = 8;
const turnLimit = 24;
const historyTextLimit = 8000;

function validateHistory(value: unknown): ChatHistory {
  if (!value || typeof value !== "object") return emptyHistory;
  const history = value as Partial<ChatHistory>;
  const ids = new Set<string>();
  const chats = (Array.isArray(history.chats) ? history.chats : [])
    .slice(0, chatLimit)
    .flatMap((chat) => {
      if (
        !chat ||
        typeof chat.id !== "string" ||
        !chat.id ||
        ids.has(chat.id) ||
        !Array.isArray(chat.turns)
      )
        return [];
      ids.add(chat.id);
      const turns: Turn[] = [];
      const rows = chat.turns.slice(-turnLimit);
      for (let index = 0; index + 1 < rows.length; index += 2) {
        const [user, assistant] = rows.slice(index, index + 2);
        if (
          user?.role !== "user" ||
          assistant?.role !== "assistant" ||
          typeof user.content !== "string" ||
          !user.content.trim() ||
          typeof assistant.content !== "string" ||
          !assistant.content.trim()
        )
          continue;
        const content = assistant.content.slice(0, historyTextLimit);
        const citations = Array.isArray(assistant.citations)
          ? assistant.citations
              .slice(0, 8)
              .flatMap((citation: AgentCitation) => {
                if (
                  !citation ||
                  typeof citation.url !== "string" ||
                  citation.url.length > 512 ||
                  typeof citation.title !== "string" ||
                  !Number.isInteger(citation.end) ||
                  citation.end < 0 ||
                  citation.end > Array.from(content).length
                )
                  return [];
                const url = URL.parse(citation.url);
                return url && ["http:", "https:"].includes(url.protocol)
                  ? [
                      {
                        end: citation.end,
                        url: url.href,
                        title: citation.title.slice(0, 120),
                      },
                    ]
                  : [];
              })
          : undefined;
        turns.push(
          { role: "user", content: user.content.slice(0, historyTextLimit) },
          {
            role: "assistant",
            content,
            citations,
            responder: isAgentResponder(assistant.responder)
              ? assistant.responder
              : undefined,
          },
        );
      }
      return [
        { id: chat.id, settings: validateSettings(chat.settings), turns },
      ];
    });
  return {
    selected:
      typeof history.selected === "string" && ids.has(history.selected)
        ? history.selected
        : (chats[0]?.id ?? ""),
    chats,
  };
}

async function agentRequest(access: string, body: object, signal: AbortSignal) {
  return fetch("/api/agents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agents-access-code": access,
    },
    body: JSON.stringify(body),
    signal,
  });
}

function errorMessage(status: number) {
  if (status === 401) return "访问码无效。";
  if (status === 429) return "请求过多，请稍后再试。";
  if (status === 424) return "当前项目无法使用所选模型，请换一个模型。";
  return "暂时无法生成回复，请重试。";
}

function AgentChat({
  access,
  settings: { model, type, effort, webSearch, siteTools },
  turns,
  onReply,
  onNewChat,
  onSettings,
  onForget,
}: {
  access: string;
  settings: Settings;
  turns: Turn[];
  onReply: (user: Turn, assistant: Turn) => void;
  onNewChat: () => void;
  onSettings: () => void;
  onForget: () => void;
}) {
  const { t, copy } = useApp();
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const node = log.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns, pending]);

  function stop() {
    request.current?.abort();
    request.current = null;
    setPending("");
  }

  async function send() {
    const content = prompt.trim();
    if (!content || request.current) return;
    const user: Turn = { role: "user", content };
    const input = [
      ...turns.slice(-8).map(({ role, content }) => ({
        role,
        content: content.slice(0, 8000),
      })),
      user,
    ];
    const body = {
      action: "chat",
      model: model === automaticModel ? undefined : model,
      type,
      effort,
      webSearch: webSearch || undefined,
      siteTools: siteTools || undefined,
      turns: input,
    };
    const encoder = new TextEncoder();
    while (
      input.length > 1 &&
      encoder.encode(JSON.stringify(body)).length > 32_768
    )
      input.splice(0, 2);

    const controller = new AbortController();
    request.current = controller;
    setPending(content);
    setError("");
    try {
      const response = await agentRequest(access, body, controller.signal);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setError(errorMessage(response.status));
        return;
      }
      const { text, citations, responder } = (await response.json()) as {
        text: string;
        citations?: AgentCitation[];
        responder?: AgentResponder;
      };
      if (controller.signal.aborted) return;
      onReply(user, { role: "assistant", content: text, citations, responder });
      setPrompt("");
    } catch {
      if (!controller.signal.aborted) setError(errorMessage(0));
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending("");
        composer.current?.focus();
      }
    }
  }

  const display = pending
    ? [...turns, { role: "user" as const, content: pending }]
    : turns;
  return (
    <Card as="section" className="panel agents-chat">
      <div className="agents-toolbar">
        <span className="muted">
          {model === automaticModel ? t("默认模型") : model} ·{" "}
          {t(agentTypes[type])}
          {webSearch ? ` · ${t("联网搜索")}` : null}
          {siteTools ? ` · ${t("站内工具")}` : null}
          {effort
            ? ` · ${t("Reasoning")}：${t(reasoningLabels[effort])}`
            : null}
        </span>
        <Button className="button small" onClick={onSettings}>
          {t("会话设置")}
        </Button>
        <Button className="button small" onClick={onNewChat}>
          {t("新对话")}
        </Button>
        <Button className="button small" onClick={onForget}>
          {t("清除访问码")}
        </Button>
      </div>
      <div
        className="agents-log"
        role="log"
        aria-label={t("当前对话")}
        ref={log}
      >
        {!display.length ? (
          <div className="agents-welcome">
            <Icon name="code" />
            <h2>{t("今天想聊什么？")}</h2>
            <p className="muted">{t(agentTypes[type])}</p>
          </div>
        ) : null}
        {display.map((turn, index) => (
          <article className="agents-message" data-role={turn.role} key={index}>
            <strong>
              {turn.role === "user"
                ? t("你")
                : turn.responder
                  ? t(agentTypes[turn.responder])
                  : "Agents"}
            </strong>
            {turn.role === "assistant" ? (
              <AgentMarkdown
                content={turn.content}
                citations={turn.citations}
              />
            ) : (
              <div className="agents-message-text">{turn.content}</div>
            )}
            {turn.role === "assistant" ? (
              <div className="agents-message-actions">
                <Button
                  className="text-btn"
                  onClick={() => void copy(turn.content)}
                >
                  {t("复制")}
                </Button>
                <AgentReadAloud access={access} text={turn.content} />
              </div>
            ) : null}
          </article>
        ))}
        {pending ? (
          <p className="muted" role="status">
            {t("正在生成回复…")}
          </p>
        ) : null}
      </div>
      <form
        className="agents-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor="agents-prompt">
          {t("输入消息")}
        </label>
        <Textarea
          id="agents-prompt"
          ref={composer}
          className="field"
          rows={3}
          maxLength={4000}
          placeholder={t("输入消息")}
          value={prompt}
          readOnly={Boolean(pending)}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void send();
            }
          }}
        />
        {error ? (
          <p className="validation-error" role="alert">
            {t(error)}
          </p>
        ) : null}
        <div className="agents-compose-footer">
          <AgentDictation
            access={access}
            disabled={Boolean(pending)}
            onText={(text) =>
              setPrompt((previous) =>
                [previous, text].filter(Boolean).join("\n").slice(0, 4000),
              )
            }
          />
          <small className="muted">
            {t("消息会发送给 OpenAI 生成回复。会话仅保存在当前浏览器。")}
          </small>
          {pending ? (
            <Button className="button" onClick={stop}>
              {t("取消")}
            </Button>
          ) : (
            <Button
              type="submit"
              className="button primary"
              disabled={!prompt.trim()}
            >
              {t("发送消息")}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function AgentSetup({
  access,
  models,
  defaultModel,
  settings,
  editing,
  onCancel,
  onStart,
}: {
  access: string;
  models: string[];
  defaultModel: string;
  settings: Settings;
  editing: boolean;
  onCancel: () => void;
  onStart: (code: string, settings: Settings) => void;
}) {
  const { t } = useApp();
  const [code, setCode] = useState("");
  const [model, setModel] = useState(settings.model);
  const [type, setType] = useState(settings.type);
  const [effort, setEffort] = useState(settings.effort);
  const [webSearch, setWebSearch] = useState(Boolean(settings.webSearch));
  const [siteTools, setSiteTools] = useState(Boolean(settings.siteTools));
  const efforts = reasoningEfforts(
    model === automaticModel ? defaultModel : model,
  );
  const activeEffort = effort && efforts.includes(effort) ? effort : undefined;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="agents-setup">
        <DialogTitle>{t("会话设置")}</DialogTitle>
        <DialogDescription className="muted">
          {t(
            editing
              ? "设置从下一条消息生效，保留当前对话。"
              : access
                ? "新对话会沿用已保存的访问码。"
                : "访问码是你的 OpenAI API Key，将保存在当前浏览器。",
          )}
        </DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = access || code.trim();
            if (value)
              onStart(value, {
                model,
                type,
                effort: activeEffort,
                webSearch,
                siteTools,
              });
          }}
        >
          {!access ? (
            <div>
              <label className="input-label" htmlFor="agents-access">
                {t("访问码")} · OpenAI API Key
              </label>
              <Input
                className="field"
                id="agents-access"
                type="password"
                autoComplete="off"
                required
                maxLength={1024}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
          ) : null}
          <div className="agents-settings-fields">
            <Select
              className="field"
              aria-label={t("模型")}
              value={model}
              onValueChange={(next) => {
                setModel(next);
                if (
                  effort &&
                  !reasoningEfforts(
                    next === automaticModel ? defaultModel : next,
                  ).includes(effort)
                )
                  setEffort(undefined);
              }}
            >
              <SelectItem value={automaticModel}>{t("默认模型")}</SelectItem>
              {models
                .filter((item) => item !== automaticModel)
                .map((item) => (
                  <SelectItem value={item} key={item}>
                    {item}
                  </SelectItem>
                ))}
            </Select>
            <Select
              className="field"
              aria-label={t("会话类型")}
              value={type}
              onValueChange={(value) => {
                if (isAgentType(value)) setType(value);
              }}
            >
              {Object.entries(agentTypes).map(([value, label]) => (
                <SelectItem value={value} key={value}>
                  {t(label)}
                </SelectItem>
              ))}
            </Select>
            <Select
              className="field"
              aria-label={t("Reasoning")}
              value={activeEffort ?? automaticModel}
              onValueChange={(value) =>
                setEffort(isReasoningEffort(value) ? value : undefined)
              }
            >
              <SelectItem value={automaticModel}>
                {t("默认推理强度")}
              </SelectItem>
              {efforts.map((item) => (
                <SelectItem value={item} key={item}>
                  {t(reasoningLabels[item])}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="agents-tool-toggles">
            <Button
              className="button small"
              aria-pressed={webSearch}
              onClick={() => setWebSearch(!webSearch)}
            >
              <Icon name="globe" />
              {t("联网搜索")}
            </Button>
            <Button
              className="button small"
              aria-pressed={siteTools}
              onClick={() => setSiteTools(!siteTools)}
            >
              {t("站内工具")}
            </Button>
          </div>
          <div className="agents-toolbar">
            <Button className="button" onClick={onCancel}>
              {t("取消")}
            </Button>
            <Button
              type="submit"
              className="button primary"
              disabled={!access && !code.trim()}
            >
              {t(editing ? "保存设置" : "进入聊天")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentsTool({
  models,
  defaultModel,
}: {
  models: string[];
  defaultModel: string;
}) {
  const { t } = useApp();
  const [access, setAccess] = usePreference(
    "agents-access-code",
    "",
    validateAccess,
  );
  const [savedSettings, setSettings] = usePreference(
    "agents-settings",
    defaultSettings,
    validateSettings,
  );
  const [setup, setSetup] = useState<"new" | "edit" | null>(null);
  const [history, setHistory] = usePreference(
    "agents-chat-history",
    emptyHistory,
    validateHistory,
  );
  const active = history.chats.find((chat) => chat.id === history.selected);
  const base =
    (setup === "new" ? savedSettings : active?.settings) ?? savedSettings;
  const normalizeSettings = (value: Settings): Settings => {
    const model = models.includes(value.model) ? value.model : automaticModel;
    const supported = reasoningEfforts(
      model === automaticModel ? defaultModel : model,
    );
    return {
      ...value,
      model,
      effort:
        value.effort && supported.includes(value.effort)
          ? value.effort
          : undefined,
    };
  };
  const settings = normalizeSettings(base);
  const chatSettings = normalizeSettings(active?.settings ?? savedSettings);

  function deleteChat() {
    if (!active || !window.confirm(t("删除这条本地会话？"))) return;
    setHistory((current) => {
      const chats = current.chats.filter((chat) => chat.id !== active.id);
      return { chats, selected: chats[0]?.id ?? "" };
    });
  }

  function saveConversation(user: Turn, assistant: Turn) {
    const id = active?.id ?? crypto.randomUUID();
    setHistory((current) => {
      const existing = current.chats.find((chat) => chat.id === id);
      if (active && !existing) return current;
      const chat = {
        id,
        settings: existing?.settings ?? chatSettings,
        turns: [...(existing?.turns ?? []), user, assistant].slice(-turnLimit),
      };
      return validateHistory({
        selected: active ? current.selected : id,
        chats: [chat, ...current.chats.filter((item) => item.id !== id)].slice(
          0,
          chatLimit,
        ),
      });
    });
  }

  return (
    <>
      <DetailHeader
        id="agents"
        description="用 AI 问答、总结、翻译和解释代码。"
      />
      {access && active ? (
        <div className="agents-history">
          <Select
            className="field"
            aria-label={t("本机会话")}
            value={active.id}
            onValueChange={(id) => {
              setHistory((current) => ({ ...current, selected: id }));
            }}
          >
            {history.chats.map((chat) => (
              <SelectItem value={chat.id} key={chat.id}>
                {chat.turns[0]?.content.replace(/\s+/g, " ").slice(0, 38) ||
                  t("新对话")}
              </SelectItem>
            ))}
          </Select>
          <Button className="button small" onClick={deleteChat}>
            {t("删除会话")}
          </Button>
        </div>
      ) : null}
      {access ? (
        <AgentChat
          key={active?.id ?? "unsaved"}
          access={access}
          settings={chatSettings}
          turns={active?.turns ?? []}
          onReply={saveConversation}
          onNewChat={() => setSetup("new")}
          onSettings={() => setSetup("edit")}
          onForget={() => {
            setAccess("");
            setSetup("new");
          }}
        />
      ) : (
        <Card as="section" className="panel agents-gate">
          <Button className="button primary" onClick={() => setSetup("new")}>
            {t("会话设置")}
          </Button>
        </Card>
      )}
      {setup ? (
        <AgentSetup
          access={access}
          models={models}
          defaultModel={defaultModel}
          settings={settings}
          editing={setup === "edit"}
          onCancel={() => setSetup(null)}
          onStart={(code, next) => {
            if (code !== access) setAccess(code);
            setSettings(next);
            if (setup === "new" && (access || !active)) {
              const id = crypto.randomUUID();
              setHistory((current) => ({
                selected: id,
                chats: [
                  { id, settings: next, turns: [] },
                  ...current.chats.filter((chat) => chat.turns.length),
                ].slice(0, chatLimit),
              }));
            } else if (active) {
              setHistory((current) => ({
                ...current,
                chats: current.chats.map((chat) =>
                  chat.id === active.id ? { ...chat, settings: next } : chat,
                ),
              }));
            }
            setSetup(null);
          }}
        />
      ) : null}
    </>
  );
}
