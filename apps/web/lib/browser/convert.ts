import {
  ConversionError,
  CONVERSION_TIMEOUT_MS,
  validateFiles,
  validateOptions,
  type ConversionRequest,
  type ConversionOutput,
  type ConversionProgress,
  type WorkerResponse,
} from "../conversions";

export async function convertInBrowser(
  input: ConversionRequest,
  signal: AbortSignal,
  onProgress: (progress: ConversionProgress) => void,
): Promise<ConversionOutput> {
  signal.throwIfAborted();
  validateFiles(input.operation, input.files);
  const request = { ...input, options: validateOptions(input.options) };
  if (input.operation === "word-pdf") {
    onProgress({ progress: null, phase: "loading" });
    const { convertWord } = await import("./word");
    signal.throwIfAborted();
    const timeout = new AbortController();
    const timer = setTimeout(
      () => timeout.abort(new ConversionError("TIMEOUT")),
      CONVERSION_TIMEOUT_MS,
    );
    const combined = AbortSignal.any([signal, timeout.signal]);
    let onAbort: () => void;
    try {
      return await Promise.race([
        convertWord(input.files[0]!, combined, onProgress),
        new Promise<never>((_, reject) => {
          onAbort = () => reject(combined.reason);
          combined.addEventListener("abort", onAbort, { once: true });
        }),
      ]);
    } finally {
      clearTimeout(timer);
      combined.removeEventListener("abort", onAbort!);
    }
  }
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined")
    throw new ConversionError("BROWSER_UNSUPPORTED");
  return new Promise((resolve, reject) => {
    const worker = new Worker("/conversion/worker.js", { type: "module" });
    const dispose = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const fail = (error: unknown) => {
      dispose();
      reject(error);
    };
    const abort = () =>
      fail(signal.reason ?? new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(
      () => fail(new ConversionError("TIMEOUT")),
      CONVERSION_TIMEOUT_MS,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => fail(new ConversionError("ENGINE_LOAD"));
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (signal.aborted) return;
      if (data.type === "progress") onProgress(data);
      else if (data.type === "error") fail(new ConversionError(data.code));
      else {
        dispose();
        resolve({ name: data.name, blob: data.blob });
      }
    };
    worker.postMessage(request);
  });
}
