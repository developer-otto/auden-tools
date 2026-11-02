"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  type Capabilities,
} from "../../lib/conversions";
import { getTool } from "../../lib/tools";
import { useApp } from "../providers";
import { DetailHeader, ErrorMessage, Notice } from "../shared";
import { Icon } from "../icon";
import { uploadCloud, uploadLocal } from "../../lib/conversion-upload";

function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
const statusLabels = {
  uploading: "正在上传",
  queued: "排队等待",
  running: "正在转换",
  succeeded: "转换完成",
  failed: "转换失败",
  cancelled: "已取消",
};
const formatLabels = { png: "PNG", jpeg: "JPG", webp: "WebP", avif: "AVIF" };

export default function FileTool({ operation }: { operation: ConversionId }) {
  const { t, locale } = useApp(),
    spec = conversionSpecs[operation];
  const [files, setFiles] = useState<File[]>([]),
    [options, setOptions] = useState<ConversionOptions>({
      ...defaultConversionOptions,
    });
  const [error, setError] = useState(""),
    [uploading, setUploading] = useState<number | null>(null),
    [dragging, setDragging] = useState(false);
  const [jobs, setJobs] = useState<ConversionJob[]>([]),
    [capabilities, setCapabilities] = useState<Capabilities | null>(null),
    [networkError, setNetworkError] = useState(false);
  const [deleting, setDeleting] = useState<string[]>([]);
  const picker = useRef<HTMLInputElement>(null),
    uploadController = useRef<AbortController | null>(null),
    dragDepth = useRef(0);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/conversions", {
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error("offline");
      const data: { capabilities: Capabilities; jobs: ConversionJob[] } =
        await response.json();
      setCapabilities(data.capabilities);
      setJobs(data.jobs);
      setNetworkError(false);
      return data.jobs.some(isActiveJob);
    } catch {
      if (!signal?.aborted) setNetworkError(true);
      return false;
    }
  }, []);
  const hasPendingJobs = jobs.some(isActiveJob);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const active = await refresh(controller.signal);
      if (!controller.signal.aborted)
        timer = setTimeout(poll, active ? 1500 : 8000);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [refresh, hasPendingJobs]);
  useEffect(() => () => uploadController.current?.abort(), []);
  const available =
    capabilities?.online &&
    (spec.engine === "built-in" || capabilities[spec.engine]);
  const displayed = jobs.filter(
    (job) => job.operation === operation && job.status !== "uploading",
  );
  const addFiles = (selection: FileList | File[] | null) => {
    if (!selection || uploading !== null) return;
    const next =
      spec.maxFiles === 1
        ? Array.from(selection)
        : [...files, ...Array.from(selection)];
    try {
      // A merge can be assembled one file at a time.
      if (next.length)
        validateFiles(
          operation,
          next.length < spec.minFiles
            ? [...next, ...next.slice(0, spec.minFiles - next.length)]
            : next,
        );
      setFiles(next);
      setError("");
    } catch (cause) {
      setError(cause instanceof ConversionError ? cause.code : "FILE_TYPE");
    }
    if (picker.current) picker.current.value = "";
  };
  const moveFile = (index: number, direction: number) => {
    setFiles((previous) => {
      const next = [...previous];
      [next[index], next[index + direction]] = [
        next[index + direction]!,
        next[index]!,
      ];
      return next;
    });
  };
  const update = <K extends keyof ConversionOptions>(
    key: K,
    value: ConversionOptions[K],
  ) => setOptions((previous) => ({ ...previous, [key]: value }));
  const submit = async () => {
    if (uploadController.current) return;
    try {
      validateFiles(operation, files);
      if (operation === "pdf-split") parsePages(options.pages, 500);
    } catch (cause) {
      setError(
        cause instanceof ConversionError ? cause.code : "INVALID_OPTIONS",
      );
      return;
    }
    setError("");
    setUploading(0);
    const controller = new AbortController();
    uploadController.current = controller;
    try {
      const upload =
        capabilities?.upload === "blob" ? uploadCloud : uploadLocal;
      const job = await upload({
        operation,
        options,
        files,
        signal: controller.signal,
        onProgress: setUploading,
      });
      setJobs((previous) => [
        job,
        ...previous.filter((item) => item.id !== job.id),
      ]);
      void refresh();
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof ConversionError ? cause.code : "UPLOAD_FAILED",
        );
    } finally {
      setUploading(null);
      uploadController.current = null;
    }
  };
  const deleteJob = async (job: ConversionJob) => {
    setDeleting((previous) => [...previous, job.id]);
    try {
      const response = await fetch(`/api/conversions/${job.id}`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 404) throw new Error("delete");
      setJobs((previous) => previous.filter((item) => item.id !== job.id));
    } catch {
      setError("UPLOAD_FAILED");
    } finally {
      setDeleting((previous) => previous.filter((id) => id !== job.id));
    }
  };
  const retryJob = async (job: ConversionJob) => {
    setDeleting((previous) => [...previous, job.id]);
    try {
      const response = await fetch(`/api/conversions/${job.id}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "FAILED");
        return;
      }
      setJobs((previous) => [data.job, ...previous]);
      setError("");
      void refresh();
    } catch {
      setError("UPLOAD_FAILED");
    } finally {
      setDeleting((previous) => previous.filter((id) => id !== job.id));
    }
  };
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return (
    <>
      <DetailHeader id={operation} description={getTool(operation).desc} />
      <div className="file-workspace">
        <section className="panel file-main">
          <div className="panel-heading">
            <h2>{t("选择文件")}</h2>
            <span
              className={`conversion-service ${available && !networkError ? "ready" : ""}`}
              role="status"
            >
              <i />
              {t(
                networkError
                  ? "连接暂时中断"
                  : !capabilities
                    ? "正在连接服务"
                    : available
                      ? "转换服务就绪"
                      : "转换服务未就绪",
              )}
            </span>
          </div>
          <div
            className={`file-dropzone ${dragging ? "dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              dragDepth.current++;
              if (uploading === null) setDragging(true);
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
              disabled={uploading !== null}
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
                          disabled={index === 0 || uploading !== null}
                          onClick={() => moveFile(index, -1)}
                        >
                          <Icon name="down" />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={t("下移文件：{name}", {
                            name: file.name,
                          })}
                          disabled={
                            index === files.length - 1 || uploading !== null
                          }
                          onClick={() => moveFile(index, 1)}
                        >
                          <Icon name="down" />
                        </button>
                      </>
                    ) : null}
                    <button
                      className="icon-btn"
                      aria-label={t("移除文件：{name}", { name: file.name })}
                      disabled={uploading !== null}
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
          {uploading !== null ? (
            <div className="upload-progress" role="status">
              <div>
                <span>
                  {t(uploading < 100 ? "正在上传" : "正在创建转换任务")}
                </span>
                <span>{uploading}%</span>
              </div>
              <progress
                value={uploading}
                max={100}
                aria-label={t("上传进度")}
              />
            </div>
          ) : null}
          {error ? (
            <ErrorMessage>
              {t(conversionErrors[error] || conversionErrors.FAILED!)}
            </ErrorMessage>
          ) : null}
          {capabilities && !available ? (
            <p className="conversion-warning">
              {t(
                capabilities.online
                  ? conversionErrors.ENGINE_UNAVAILABLE!
                  : conversionErrors.WORKER_OFFLINE!,
              )}
            </p>
          ) : null}
          <div className="file-submit">
            <span>
              <Icon name="shield" />
              {t("完成后保留 1 小时，可随时删除")}
            </span>
            {uploading !== null ? (
              <button
                className="button"
                onClick={() => uploadController.current?.abort()}
              >
                {t("取消上传")}
              </button>
            ) : (
              <button
                className="button primary"
                disabled={
                  !available || networkError || files.length < spec.minFiles
                }
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
          <fieldset disabled={uploading !== null} aria-label={t("转换设置")}>
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
                <h3>DOC / DOCX → PDF</h3>
                <p className="file-hint">
                  {t(
                    "转换使用服务器字体。复杂排版可能有差异，下载后请检查。暂不支持 PDF 转 Word。",
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
                      : "重新编码为常见播放格式，画质可能略有损失。最长 10 分钟、最高 4K。",
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
                    "提取第一条音轨。MP3 / M4A 会重新编码；WAV 文件较大。最长 10 分钟。",
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
                "文件会上传到服务器处理，仅当前浏览器会话可下载。完成后 1 小时自动清理，也可立即删除。",
              )}
            </p>
          </div>
        </aside>
      </div>
      <section className="panel conversion-history">
        <div className="panel-heading">
          <h2>{t("最近的转换")}</h2>
          <span className="muted">{t("此浏览器会话")}</span>
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
                      {t(statusLabels[job.status])}
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
                  {job.output ? (
                    <small className="job-expiry">
                      {t("可下载至 {time}", {
                        time: new Intl.DateTimeFormat(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(job.expiresAt),
                      })}
                    </small>
                  ) : null}
                </div>
                <div className="job-actions">
                  {job.status === "failed" ? (
                    <button
                      className="button small"
                      disabled={!available || deleting.includes(job.id)}
                      onClick={() => void retryJob(job)}
                    >
                      {t("重试转换")}
                    </button>
                  ) : null}
                  {job.output ? (
                    <a
                      className="button small primary"
                      href={`/api/conversions/${job.id}/download`}
                      download
                    >
                      <Icon name="down" />
                      {t("下载")}
                    </a>
                  ) : null}
                  <button
                    className="button small"
                    disabled={deleting.includes(job.id)}
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
          "请保持浏览器 Cookie 可用，以便刷新后继续查看任务。关闭页面不影响已排队的转换。",
        )}
      </Notice>
    </>
  );
}
