"use client";

import { useEffect, useRef, useState } from "react";
import {
  agentAudioExtensions,
  maxAgentAudioBytes,
  maxAgentSpeechChars,
} from "../../lib/agent-media";
import { useApp } from "../providers";
import { Button } from "../ui/button";

type Recording = {
  recorder: MediaRecorder;
  stream: MediaStream;
  timer?: ReturnType<typeof setTimeout>;
};

const formats = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function release(recording: Recording) {
  clearTimeout(recording.timer);
  recording.stream.getTracks().forEach((track) => track.stop());
}

async function sendAudio(
  access: string,
  action: "transcribe" | "speech",
  body: Blob | string,
  signal: AbortSignal,
) {
  return fetch(`/api/agents/${action}`, {
    method: "POST",
    headers: {
      "x-agents-access-code": access,
      "Content-Type":
        typeof body === "string" ? "text/plain; charset=utf-8" : body.type,
    },
    body,
    signal,
  });
}

export function AgentDictation({
  access,
  onText,
  disabled,
}: {
  access: string;
  onText: (text: string) => void;
  disabled: boolean;
}) {
  const { t } = useApp();
  const recording = useRef<Recording | null>(null);
  const request = useRef<AbortController | null>(null);
  const alive = useRef(false);
  const [state, setState] = useState<
    "idle" | "opening" | "recording" | "transcribing"
  >("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
      const active = recording.current;
      recording.current = null;
      if (active) {
        if (active.recorder.state !== "inactive") active.recorder.stop();
        release(active);
      }
    };
  }, []);

  async function transcribe(blob: Blob) {
    const operation = new AbortController();
    request.current = operation;
    setState("transcribing");
    try {
      const response = await sendAudio(
        access,
        "transcribe",
        blob,
        operation.signal,
      );
      if (!response.ok) throw new Error();
      const { text } = (await response.json()) as { text: string };
      if (!operation.signal.aborted) onText(text);
    } catch {
      if (!operation.signal.aborted) setError("语音转文字失败，请重试。");
    } finally {
      if (request.current === operation && alive.current) {
        request.current = null;
        setState("idle");
      }
    }
  }

  async function start() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("当前浏览器无法录音。");
      return;
    }
    setError("");
    setState("opening");
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = formats.find((format) =>
        MediaRecorder.isTypeSupported(format),
      );
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 64_000,
      });
      const active: Recording = { recorder, stream };
      const chunks: Blob[] = [];
      let bytes = 0;
      let exceeded = false;
      recorder.ondataavailable = ({ data }) => {
        if (recording.current !== active || exceeded || !data.size) return;
        bytes += data.size;
        if (bytes > maxAgentAudioBytes) {
          exceeded = true;
          if (recorder.state !== "inactive") recorder.stop();
        } else chunks.push(data);
      };
      recorder.onerror = () => {
        if (recording.current !== active) return;
        recording.current = null;
        release(active);
        setState("idle");
        setError("录音失败，请检查麦克风。");
      };
      recorder.onstop = () => {
        release(active);
        if (!alive.current || recording.current !== active) return;
        recording.current = null;
        const format = recorder.mimeType.split(";")[0] ?? "";
        if (
          exceeded ||
          !bytes ||
          !Object.hasOwn(agentAudioExtensions, format)
        ) {
          setState("idle");
          setError("语音转文字失败，请重试。");
          return;
        }
        void transcribe(new Blob(chunks, { type: format }));
      };
      recording.current = active;
      recorder.start(250);
      active.timer = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 60_000);
      setState("recording");
    } catch {
      recording.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      if (alive.current) {
        setState("idle");
        setError("录音失败，请检查麦克风。");
      }
    }
  }

  return (
    <div className="agents-audio">
      {state === "idle" ? (
        <Button
          className="button small"
          disabled={disabled}
          onClick={() => void start()}
        >
          {t("语音输入")}
        </Button>
      ) : state === "recording" ? (
        <Button
          className="button small"
          onClick={() => {
            const active = recording.current;
            if (active?.recorder.state === "recording") active.recorder.stop();
          }}
        >
          {t("停止并转文字")}
        </Button>
      ) : (
        <span className="muted" role="status">
          {t(state === "opening" ? "正在打开麦克风…" : "正在转写…")}
        </span>
      )}
      {error ? (
        <span className="validation-error" role="alert">
          {t(error)}
        </span>
      ) : null}
    </div>
  );
}

export function AgentReadAloud({
  access,
  text,
}: {
  access: string;
  text: string;
}) {
  const { t } = useApp();
  const request = useRef<AbortController | null>(null);
  const source = useRef("");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  useEffect(
    () => () => {
      request.current?.abort();
      if (source.current) URL.revokeObjectURL(source.current);
    },
    [],
  );

  async function load() {
    if (request.current) return;
    const operation = new AbortController();
    request.current = operation;
    setState("loading");
    try {
      const response = await sendAudio(
        access,
        "speech",
        text.slice(0, maxAgentSpeechChars),
        operation.signal,
      );
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (operation.signal.aborted) return;
      source.current = URL.createObjectURL(blob);
      setState("ready");
    } catch {
      if (!operation.signal.aborted) setState("error");
    } finally {
      if (request.current === operation) request.current = null;
    }
  }

  return (
    <div className="agents-audio">
      {state === "ready" ? (
        <>
          <audio
            controls
            src={source.current}
            aria-label={t("AI 生成的朗读语音")}
          />
          <small className="muted">{t("AI 生成的朗读语音")}</small>
          <Button
            className="text-btn"
            onClick={() => {
              URL.revokeObjectURL(source.current);
              source.current = "";
              setState("idle");
            }}
          >
            {t("关闭")}
          </Button>
        </>
      ) : (
        <Button
          className="text-btn"
          disabled={state === "loading"}
          onClick={() => void load()}
        >
          {t(
            state === "loading"
              ? "正在生成语音…"
              : text.length > maxAgentSpeechChars
                ? "朗读前 4000 字"
                : "AI 朗读",
          )}
        </Button>
      )}
      {state === "error" ? (
        <span role="alert">{t("朗读失败，请重试。")}</span>
      ) : null}
    </div>
  );
}
