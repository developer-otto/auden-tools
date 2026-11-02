import { renderAsync } from "docx-preview";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import {
  ConversionError,
  MAX_WORD_PAGES,
  MAX_OUTPUT_BYTES,
  type ConversionOutput,
  type ConversionProgress,
} from "../conversions";

// Inspect the ZIP directory before expanding a DOCX in browser memory.
export function validateDocxArchive(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  let end = -1;
  for (
    let offset = view.byteLength - 22;
    offset >= Math.max(0, view.byteLength - 65557);
    offset--
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new ConversionError("INVALID_FILE");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true),
    total = 0;
  if (!count || count > 2000) throw new ConversionError("WORD_LIMIT");
  for (let i = 0; i < count; i++) {
    if (
      offset + 46 > view.byteLength ||
      view.getUint32(offset, true) !== 0x02014b50
    )
      throw new ConversionError("INVALID_FILE");
    total += view.getUint32(offset + 24, true);
    if (total > 64 * 1024 * 1024) throw new ConversionError("WORD_LIMIT");
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
}

export async function convertWord(
  file: File,
  signal: AbortSignal,
  onProgress: (value: ConversionProgress) => void,
): Promise<ConversionOutput> {
  const bytes = await file.arrayBuffer();
  signal.throwIfAborted();
  validateDocxArchive(bytes);
  const frame = document.createElement("iframe");
  frame.title = "Local document rendering";
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.style.cssText =
    "position:fixed;left:-20000px;top:0;width:1200px;height:1600px;border:0;pointer-events:none";
  // DOCX markup cannot execute scripts, navigate, or fetch embedded external URLs.
  frame.srcdoc =
    "<!doctype html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data: blob:; font-src data: blob:; style-src 'unsafe-inline'\"><style>html,body{margin:0;background:white;color:black}*{box-sizing:border-box}</style></head><body></body></html>";
  let rejectReady: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    frame.onload = () => resolve();
    frame.onerror = () => reject(new ConversionError("FAILED"));
  });
  const remove = () => {
    frame.remove();
    rejectReady(signal.reason);
  };
  signal.addEventListener("abort", remove, { once: true });
  document.body.append(frame);
  try {
    await ready;
    signal.throwIfAborted();
    const doc = frame.contentDocument!;
    onProgress({ progress: 5, phase: "converting" });
    await renderAsync(bytes, doc.body, undefined, {
      className: "local-docx",
      inWrapper: false,
      useBase64URL: true,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      renderAltChunks: false,
      renderComments: false,
      experimental: false,
    });
    signal.throwIfAborted();
    await doc.fonts.ready;
    await Promise.all(
      Array.from(doc.images, (image) => image.decode().catch(() => undefined)),
    );
    signal.throwIfAborted();
    const sections = Array.from(
      doc.querySelectorAll<HTMLElement>("section.local-docx"),
    );
    if (!sections.length) throw new ConversionError("INVALID_FILE");
    const pdf = await PDFDocument.create();
    for (let index = 0; index < sections.length; index++) {
      signal.throwIfAborted();
      const section = sections[index]!;
      const width = section.getBoundingClientRect().width;
      const height = Math.max(
        section.scrollHeight,
        section.getBoundingClientRect().height,
      );
      const pageHeight =
        parseFloat(section.style.minHeight) || (width * 297) / 210;
      // docx-preview emits explicit Word page breaks; paginate overflow as well.
      const measuredHeight = section.style.minHeight
        ? parseFloat(getComputedStyle(section).minHeight)
        : pageHeight;
      const sliceHeight =
        measuredHeight > 0 ? measuredHeight : (width * 297) / 210;
      const pages = Math.ceil((height - 1) / sliceHeight);
      if (!width || width > 2400 || pdf.getPageCount() + pages > MAX_WORD_PAGES)
        throw new ConversionError("WORD_LIMIT");
      for (let part = 0; part < pages; part++) {
        signal.throwIfAborted();
        const canvas = await html2canvas(section, {
          scale: 1.5,
          backgroundColor: "#ffffff",
          logging: false,
          width,
          height: sliceHeight,
          y: part * sliceHeight,
          windowWidth: 1200,
          windowHeight: 1600,
          scrollX: 0,
          scrollY: 0,
          imageTimeout: 5000,
          useCORS: false,
        });
        signal.throwIfAborted();
        const image = await pdf.embedJpg(canvas.toDataURL("image/jpeg", 0.92));
        const page = pdf.addPage([width * 0.75, sliceHeight * 0.75]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: page.getWidth(),
          height: page.getHeight(),
        });
        canvas.width = canvas.height = 0;
        onProgress({
          progress: Math.round(
            10 + ((index + (part + 1) / pages) / sections.length) * 85,
          ),
          phase: "converting",
        });
      }
    }
    signal.throwIfAborted();
    const result = await pdf.save();
    if (result.byteLength > MAX_OUTPUT_BYTES)
      throw new ConversionError("OUTPUT_TOO_LARGE");
    return {
      name: file.name.replace(/\.docx$/i, ".pdf"),
      blob: new Blob([new Uint8Array(result)], { type: "application/pdf" }),
    };
  } finally {
    signal.removeEventListener("abort", remove);
    frame.remove();
  }
}
