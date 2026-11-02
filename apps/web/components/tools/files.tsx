"use client";
import { useEffect, useRef, useState } from "react";
import {
  ConversionError,
  conversionErrors,
  conversionSpecs,
  defaultConversionOptions,
  isActiveJob,
  parsePages,
  validateFiles,
  type ConversionId,
  type ConversionJob,
  type ConversionOptions,
  type ConversionRequest,
} from "../../lib/conversions";
import { getTool } from "../../lib/tools";
import { useApp } from "../providers";
import { DetailHeader, ErrorMessage, Notice } from "../shared";
import { Icon } from "../icon";

function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
const statusLabels = {
  running: "正在转换",
  succeeded: "转换完成",
  failed: "转换失败",
  cancelled: "已取消",
};
const formatLabels = { png: "PNG", jpeg: "JPG", webp: "WebP" };

export default function FileTool({ operation }: { operation: ConversionId }) {
  return <FileWorkspace key={operation} operation={operation} />;
}

function FileWorkspace({ operation }: { operation: ConversionId }) {
  const { t, locale } = useApp(),
    spec = conversionSpecs[operation];
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<ConversionOptions>({
    ...defaultConversionOptions,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const picker = useRef<HTMLInputElement>(null),
    dragDepth = useRef(0);
  const active = useRef<{ id: string; controller: AbortController } | null>(
    null,
  );
  const resources = useRef(
    new Map<string, { request: ConversionRequest; url?: string }>(),
  );
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const retained = resources.current;
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
      for (const resource of retained.values())
        if (resource.url) URL.revokeObjectURL(resource.url);
      retained.clear();
    };
  }, []);
  const displayed = jobs;
  const addFiles = (selection: FileList | File[] | null) => {
    if (!selection || busy) return;
    const next =
      spec.maxFiles === 1
        ? Array.from(selection)
        : [...files, ...Array.from(selection)];
    try {
      // Let a merge be assembled one file at a time without duplicating its size.
      if (next.length && next.length < spec.minFiles) {
        validateFiles(operation, [
          ...next,
          { name: "placeholder.pdf", size: 1 },
        ]);
      } else if (next.length) validateFiles(operation, next);
      setFiles(next);
      setError("");
    } catch (cause) {
      setError(cause instanceof ConversionError ? cause.code : "FILE_TYPE");
    }
    if (picker.current) picker.current.value = "";
  };
  const moveFile = (index: number, direction: number) =>
    setFiles((previous) => {
      const next = [...previous];
      [next[index], next[index + direction]] = [
        next[index + direction]!,
        next[index]!,
      ];
      return next;
    });
  const update = <K extends keyof ConversionOptions>(
    key: K,
    value: ConversionOptions[K],
  ) => setOptions((previous) => ({ ...previous, [key]: value }));
  const run = async (request: ConversionRequest, id = crypto.randomUUID()) => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = { id, controller };
    setBusy(true);
    setError("");
    const previous = resources.current.get(id);
    if (previous?.url) URL.revokeObjectURL(previous.url);
    resources.current.delete(id);
    resources.current.set(id, { request });
    // Bound retained files and downloads to the three most recent conversions.
    while (resources.current.size > 3) {
      const oldest = resources.current.keys().next().value!;
      const resource = resources.current.get(oldest)!;
      if (resource.url) URL.revokeObjectURL(resource.url);
      resources.current.delete(oldest);
    }
    const job: ConversionJob = {
      id,
      operation,
      status: "running",
      createdAt: Date.now(),
      progress: null,
      phase: "loading",
      error: null,
      inputs: request.files.map(({ name, size }) => ({ name, size })),
      output: null,
    };
    setJobs((previous) => [
      job,
      ...previous.filter(
        (item) => item.id !== id && resources.current.has(item.id),
      ),
    ]);
    const change = (patch: Partial<ConversionJob>) => {
      if (mounted.current)
        setJobs((previous) =>
          previous.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        );
    };
    try {
      const { convertInBrowser } = await import("../../lib/browser/convert");
      controller.signal.throwIfAborted();
      const output = await convertInBrowser(request, controller.signal, change);
      controller.signal.throwIfAborted();
      if (!mounted.current) return;
      const url = URL.createObjectURL(output.blob);
      resources.current.set(id, { request, url });
      change({
        status: "succeeded",
        progress: 100,
        output: { name: output.name, size: output.blob.size, url },
      });
    } catch (cause) {
      change(
        controller.signal.aborted
          ? { status: "cancelled", progress: null }
          : {
              status: "failed",
              error: cause instanceof ConversionError ? cause.code : "FAILED",
              progress: null,
            },
      );
    } finally {
      if (active.current?.id === id) active.current = null;
      if (mounted.current) setBusy(false);
    }
  };
  const submit = () => {
    try {
      validateFiles(operation, files);
      if (operation === "pdf-split") parsePages(options.pages, 500);
      void run({ operation, files: [...files], options: { ...options } });
    } catch (cause) {
      setError(
        cause instanceof ConversionError ? cause.code : "INVALID_OPTIONS",
      );
    }
  };
  const deleteJob = (job: ConversionJob) => {
    if (active.current?.id === job.id) {
      active.current.controller.abort();
      return;
    }
    const resource = resources.current.get(job.id);
    if (resource?.url) URL.revokeObjectURL(resource.url);
    resources.current.delete(job.id);
    setJobs((previous) => previous.filter((item) => item.id !== job.id));
  };
  const retryJob = (job: ConversionJob) => {
    const resource = resources.current.get(job.id);
    if (resource) void run(resource.request, job.id);
  };
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return (
    <>
      <DetailHeader id={operation} description={getTool(operation).desc} />
      <div className="file-workspace">
        <section className="panel file-main">
          <div className="panel-heading">
            <h2>{t("选择文件")}</h2>
            <span className="conversion-service ready" role="status">
              <i />
              {t("浏览器本地处理")}
            </span>
          </div>
          <div
            className={`file-dropzone ${dragging ? "dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              dragDepth.current++;
              if (!busy) setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              if (--dragDepth.current <= 0) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              dragDepth.current = 0;
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
          >
            <span className="file-upload-icon">
              <Icon name="upload" />
            </span>
            <h3>{t("把文件拖到这里")}</h3>
            <p>
              {spec.extensions.map((value) => value.toUpperCase()).join(" · ")}
            </p>
            <button
              className="button"
              onClick={() => picker.current?.click()}
              disabled={busy}
            >
              <Icon name="plus" />
              {t(files.length ? "添加或替换文件" : "选择本地文件")}
            </button>
            <input
              ref={picker}
              type="file"
              name="conversion-files"
              aria-label={t("选择文件")}
              accept={spec.extensions
                .map((extension) => `.${extension}`)
                .join(",")}
              multiple={spec.maxFiles > 1}
              onChange={(event) => addFiles(event.target.files)}
              hidden
            />
            <small>
              {t("最多 {count} 个文件，单个不超过 {size} MB", {
                count: spec.maxFiles,
                size: spec.maxFileBytes / 1024 / 1024,
              })}
              {spec.maxFiles > 1
                ? ` · ${t("总计不超过 {size} MB", { size: spec.maxTotalBytes / 1024 / 1024 })}`
                : ""}
            </small>
          </div>
          {files.length ? (
            <div className="selected-files">
              <div className="file-list-caption">
                <span>
                  {t("已选择 {count} 个文件", { count: files.length })}
                </span>
                <span>{sizeLabel(totalSize)}</span>
              </div>
              {files.map((file, index) => (
                <div className="selected-file" key={`${file.name}-${index}`}>
                  <span className="file-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="file-name">
                    <strong>{file.name}</strong>
                    <small>{sizeLabel(file.size)}</small>
                  </div>
                  <div className="file-row-actions">
                    {spec.maxFiles > 1 ? (
                      <>
                        <button
                          className="icon-btn move-up"
                          aria-label={t("上移文件：{name}", {
                            name: file.name,
                          })}
                          disabled={index === 0 || busy}
                          onClick={() => moveFile(index, -1)}
                        >
                          <Icon name="down" />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={t("下移文件：{name}", {
                            name: file.name,
                          })}
                          disabled={index === files.length - 1 || busy}
                          onClick={() => moveFile(index, 1)}
                        >
                          <Icon name="down" />
                        </button>
                      </>
                    ) : null}
                    <button
                      className="icon-btn"
                      aria-label={t("移除文件：{name}", { name: file.name })}
                      disabled={busy}
                      onClick={() =>
                        setFiles((previous) =>
                          previous.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {error ? (
            <ErrorMessage>
              {t(conversionErrors[error] || conversionErrors.FAILED!)}
            </ErrorMessage>
          ) : null}
          <div className="file-submit">
            <span>
              <Icon name="shield" />
              {t("文件不上传，仅在本机处理")}
            </span>
            {busy ? (
              <button
                className="button"
                onClick={() => active.current?.controller.abort()}
              >
                {t("取消任务")}
              </button>
            ) : (
              <button
                className="button primary"
                disabled={files.length < spec.minFiles}
                onClick={submit}
              >
                <Icon name="arrows" />
                {t("开始转换")}
              </button>
            )}
          </div>
        </section>
        <aside className="panel file-settings">
          <span className="eyebrow">CONVERSION SETTINGS</span>
          <h2>{t("转换设置")}</h2>
          <fieldset disabled={busy} aria-label={t("转换设置")}>
            {operation === "image" ? (
              <>
                <span className="field-label">{t("输出格式")}</span>
                <div
                  className="file-format-options"
                  id="image-format"
                  role="group"
                  aria-label={t("输出格式")}
                >
                  {Object.entries(formatLabels).map(([value, label]) => (
                    <button
                      key={value}
                      className={
                        options.imageFormat === value ? "selected" : ""
                      }
                      aria-pressed={options.imageFormat === value}
                      onClick={() =>
                        update(
                          "imageFormat",
                          value as ConversionOptions["imageFormat"],
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {options.imageFormat !== "png" ? (
                  <label className="file-setting">
                    <span>
                      {t("图片质量")}
                      <b>{options.quality}%</b>
                    </span>
                    <input
                      type="range"
                      name="image-quality"
                      min="10"
                      max="100"
                      value={options.quality}
                      onChange={(event) =>
                        update("quality", Number(event.target.value))
                      }
                    />
                  </label>
                ) : null}
                <p className="file-hint">
                  {t(
                    "PNG 保留透明度；JPG 使用白色背景。转换会移除图片元数据。",
                  )}
                </p>
              </>
            ) : null}
            {operation === "pdf-split" ? (
              <>
                <label className="field-label" htmlFor="pdf-pages">
                  {t("提取页码")}
                </label>
                <input
                  className="field"
                  id="pdf-pages"
                  name="pdf-pages"
                  value={options.pages}
                  placeholder="1-3,5,8-10"
                  onChange={(event) => update("pages", event.target.value)}
                />
                <p className="file-hint">
                  {t(
                    "按输入顺序提取为一份 PDF，重复页码自动去重。最多 500 页。",
                  )}
                </p>
              </>
            ) : null}
            {operation === "pdf-merge" ? (
              <div className="file-setting-summary">
                <Icon name="files" />
                <h3>{t("按列表顺序合并")}</h3>
                <p className="file-hint">
                  {t("使用上下箭头调整顺序，最多合并 20 个文件、500 页。")}
                </p>
              </div>
            ) : null}
            {operation === "images-pdf" ? (
              <>
                <label className="field-label" htmlFor="pdf-paper">
                  {t("页面尺寸")}
                </label>
                <select
                  className="field"
                  id="pdf-paper"
                  name="pdf-paper"
                  value={options.paper}
                  onChange={(event) =>
                    update("paper", event.target.value as "a4" | "fit")
                  }
                >
                  <option value="a4">{t("A4 · 自动横竖向")}</option>
                  <option value="fit">{t("适应图片尺寸")}</option>
                </select>
                <p className="file-hint">
                  {t("每张图片独占一页，按列表顺序排列。")}
                </p>
              </>
            ) : null}
            {operation === "word-pdf" ? (
              <div className="file-setting-summary">
                <Icon name="file" />
                <h3>DOCX → PDF</h3>
                <p className="file-hint">
                  {t(
                    "仅支持 DOCX，按浏览器显示效果导出图片型 PDF，文字不可选中。复杂排版可能变化，最多 30 页。",
                  )}
                </p>
              </div>
            ) : null}
            {operation === "video-mp4" ? (
              <>
                <label className="field-label" htmlFor="video-mode">
                  {t("转换模式")}
                </label>
                <select
                  className="field"
                  id="video-mode"
                  name="video-mode"
                  value={options.videoMode}
                  onChange={(event) =>
                    update(
                      "videoMode",
                      event.target.value as "compatible" | "copy",
                    )
                  }
                >
                  <option value="compatible">
                    {t("兼容模式 · H.264 + AAC")}
                  </option>
                  <option value="copy">{t("快速封装 · 保留原始画质")}</option>
                </select>
                <p className="file-hint">
                  {t(
                    options.videoMode === "copy"
                      ? "仅适用于 H.264 视频和 AAC 音频，其他编码请选择兼容模式。"
                      : "重新编码为 H.264 + AAC。最长 5 分钟、最高 1080p，速度取决于设备性能。",
                  )}
                </p>
              </>
            ) : null}
            {operation === "audio-extract" ? (
              <>
                <label className="field-label" htmlFor="audio-format">
                  {t("音频格式")}
                </label>
                <select
                  className="field"
                  id="audio-format"
                  name="audio-format"
                  value={options.audioFormat}
                  onChange={(event) =>
                    update(
                      "audioFormat",
                      event.target.value as ConversionOptions["audioFormat"],
                    )
                  }
                >
                  <option value="mp3">MP3 · 192 kbps</option>
                  <option value="m4a">M4A / AAC · 192 kbps</option>
                  <option value="wav">WAV · PCM 16-bit</option>
                </select>
                <p className="file-hint">
                  {t(
                    "提取第一条音轨。MP3 / M4A 会重新编码；WAV 文件较大。最长 5 分钟、最高 1080p。",
                  )}
                </p>
              </>
            ) : null}
          </fieldset>
          <div className="file-privacy">
            <Icon name="shield" />
            <h3>{t("关于你的文件")}</h3>
            <p>
              {t(
                "文件在浏览器内处理，不上传、不保存在云端。刷新、离开此工具或关闭页面会清除记录和结果，请及时下载。",
              )}
            </p>
          </div>
        </aside>
      </div>
      <section className="panel conversion-history">
        <div className="panel-heading">
          <h2>{t("最近的转换")}</h2>
          <span className="muted">{t("当前页面 · 最近 3 次")}</span>
        </div>
        {displayed.length ? (
          <div className="conversion-jobs">
            {displayed.map((job) => (
              <article key={job.id} className={`conversion-job ${job.status}`}>
                <span className="job-icon">
                  <Icon
                    name={
                      job.status === "succeeded"
                        ? "check"
                        : job.status === "failed"
                          ? "close"
                          : "file"
                    }
                  />
                </span>
                <div className="job-content">
                  <strong className="job-title">
                    {job.output?.name ||
                      job.inputs.map((file) => file.name).join(" + ")}
                  </strong>
                  <div className="job-meta">
                    <span>
                      {t(
                        job.status === "running" && job.phase === "loading"
                          ? "正在加载本地引擎"
                          : statusLabels[job.status],
                      )}
                      {job.status === "running" && job.progress !== null
                        ? ` · ${job.progress}%`
                        : ""}
                    </span>
                    <span>{job.output ? sizeLabel(job.output.size) : ""}</span>
                    <time dateTime={new Date(job.createdAt).toISOString()}>
                      {new Intl.DateTimeFormat(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(job.createdAt)}
                    </time>
                  </div>
                  {job.status === "running" ? (
                    <progress
                      max={100}
                      value={job.progress ?? undefined}
                      aria-label={t("转换进度")}
                    />
                  ) : null}
                  {job.error ? (
                    <p className="validation-error">
                      {t(
                        conversionErrors[job.error] || conversionErrors.FAILED!,
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="job-actions">
                  {["failed", "cancelled"].includes(job.status) ? (
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() => void retryJob(job)}
                    >
                      {t("重试转换")}
                    </button>
                  ) : null}
                  {job.output ? (
                    <a
                      className="button small primary"
                      href={job.output.url}
                      download={job.output.name}
                    >
                      <Icon name="down" />
                      {t("下载")}
                    </a>
                  ) : null}
                  <button
                    className="button small"
                    onClick={() => void deleteJob(job)}
                  >
                    {t(isActiveJob(job) ? "取消任务" : "删除文件")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="file-empty-history">
            <Icon name="history" />
            <p>{t("转换完成后，下载文件会出现在这里。")}</p>
          </div>
        )}
      </section>
      <Notice>
        {t(
          "转换时请保持页面打开。首次使用音视频功能需加载约 31 MB 的本地引擎，文件始终留在你的设备上。",
        )}
      </Notice>
    </>
  );
}
