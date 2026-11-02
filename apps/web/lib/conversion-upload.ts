import {
  ConversionError,
  type ConversionId,
  type ConversionJob,
  type ConversionOptions,
} from "./conversions";

type Upload = {
  operation: ConversionId;
  options: ConversionOptions;
  files: File[];
  signal: AbortSignal;
  onProgress: (value: number) => void;
};

export async function uploadCloud(input: Upload): Promise<ConversionJob> {
  const { upload } = await import("@vercel/blob/client");
  let id: string | undefined;
  let completed = false;
  try {
    const response = await fetch("/api/conversions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: input.signal,
      body: JSON.stringify({
        operation: input.operation,
        options: input.options,
        files: input.files.map(({ name, size }) => ({ name, size })),
      }),
    });
    const reservation = await response.json();
    if (!response.ok)
      throw new ConversionError(reservation.error || "UPLOAD_FAILED");
    id = reservation.job.id;
    const total = input.files.reduce((sum, file) => sum + file.size, 0);
    let loaded = 0;
    for (const [index, file] of input.files.entries()) {
      input.signal.throwIfAborted();
      await upload(reservation.uploads[index].pathname, file, {
        access: "private",
        handleUploadUrl: "/api/conversions/upload",
        clientPayload: id,
        multipart: file.size > 4 * 1024 * 1024,
        abortSignal: input.signal,
        onUploadProgress: (event) =>
          input.onProgress(
            Math.min(99, Math.round(((loaded + event.loaded) / total) * 100)),
          ),
      });
      loaded += file.size;
    }
    const finish = await fetch(`/api/conversions/${id}/complete`, {
      method: "POST",
      signal: input.signal,
    });
    const data = await finish.json();
    if (!finish.ok) throw new ConversionError(data.error || "UPLOAD_FAILED");
    completed = true;
    input.onProgress(100);
    return data.job;
  } finally {
    if (id && !completed) {
      // A separate request survives aborting the upload/navigation. Workflow
      // expiry is the fallback if the network is unavailable.
      await fetch(`/api/conversions/${id}`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => undefined);
    }
  }
}

export function uploadLocal(input: Upload): Promise<ConversionJob> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest(),
      form = new FormData();
    input.files.forEach((file) => form.append("files", file, file.name));
    request.open(
      "POST",
      `/api/conversions?${new URLSearchParams({ operation: input.operation, options: JSON.stringify(input.options) })}`,
    );
    request.responseType = "json";
    request.timeout = 310000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        input.onProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
    };
    request.onload = () =>
      request.status === 202
        ? resolve(request.response.job)
        : reject(
            new ConversionError(request.response?.error || "UPLOAD_FAILED"),
          );
    request.onerror = () => reject(new ConversionError("UPLOAD_FAILED"));
    request.ontimeout = () => reject(new ConversionError("UPLOAD_TIMEOUT"));
    request.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    const abort = () => request.abort();
    input.signal.addEventListener("abort", abort, { once: true });
    request.onloadend = () => input.signal.removeEventListener("abort", abort);
    if (input.signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    request.send(form);
  });
}
