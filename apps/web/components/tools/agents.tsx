"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "../providers";
import { DetailHeader } from "../shared";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

type Turn = { role: "user" | "assistant"; content: string };

export default function AgentsTool() {
  const { t } = useApp();
  const [access, setAccess] = useState("");
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function send() {
    if (!prompt.trim() || !access.trim() || request.current) return;
    const user: Turn = { role: "user", content: prompt.trim() };
    const input = [...turns.slice(-8), user];
    const encoder = new TextEncoder();
    while (
      input.length > 1 &&
      encoder.encode(JSON.stringify(input)).length > 32_768
    )
      input.splice(0, 2);

    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agents-access-code": access.trim(),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setError(
          response.status === 401
            ? "访问码无效。"
            : response.status === 503
              ? "Agents 尚未配置。"
              : response.status === 429
                ? "请求过多，请稍后再试。"
                : "暂时无法生成回复，请重试。",
        );
        return;
      }
      const { text } = (await response.json()) as { text: string };
      if (controller.signal.aborted) return;
      setTurns([...input, { role: "assistant", content: text.slice(0, 8000) }]);
      setPrompt("");
    } catch {
      if (!controller.signal.aborted) setError("暂时无法生成回复，请重试。");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  function stop() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
  }

  return (
    <>
      <DetailHeader
        id="agents"
        description="用 AI 问答、总结、翻译和解释代码。"
      />
      <Card as="section">
        <p className="muted">
          {t(
            "消息会发送给 OpenAI 生成回复。本站不保存聊天记录，离开页面即清除。",
          )}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <div className="field-group">
            <label className="input-label" htmlFor="agents-access">
              {t("访问码")}
            </label>
            <Input
              className="field"
              id="agents-access"
              type="password"
              autoComplete="off"
              maxLength={128}
              value={access}
              onChange={(event) => setAccess(event.target.value)}
            />
          </div>
          <div role="log" aria-label={t("当前对话")}>
            {turns.map((turn, index) => (
              <div className="results-box" key={index}>
                <strong>{turn.role === "user" ? t("你") : "Agents"}</strong>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {turn.content}
                </p>
              </div>
            ))}
          </div>
          <div className="field-group">
            <label className="input-label" htmlFor="agents-prompt">
              {t("输入消息")}
            </label>
            <Textarea
              className="field"
              style={{ height: "auto", paddingBlock: 10, resize: "vertical" }}
              id="agents-prompt"
              rows={4}
              maxLength={4000}
              value={prompt}
              disabled={busy}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </div>
          {error ? <p role="alert">{t(error)}</p> : null}
          <div className="button-row">
            <Button
              type="submit"
              className="button primary"
              disabled={busy || !access.trim() || !prompt.trim()}
            >
              {t("发送消息")}
            </Button>
            {busy ? (
              <Button className="button" onClick={stop}>
                {t("取消")}
              </Button>
            ) : null}
            <Button
              className="button"
              onClick={() => {
                stop();
                setTurns([]);
                setPrompt("");
                setError("");
              }}
            >
              {t("清空对话")}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
