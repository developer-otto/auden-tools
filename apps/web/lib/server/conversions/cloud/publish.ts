import { put, del } from "@vercel/blob";
import { Readable, Transform } from "node:stream";
import { ConversionError } from "../../../conversions.ts";
import type { CloudStore } from "./store.ts";
import type { CloudOutput } from "./model.ts";

// Dependencies are explicit so cancellation during Blob I/O can be verified
// against the actual database without creating paid cloud resources.
export async function publishResult(
  id: string,
  output: CloudOutput,
  source: AsyncIterable<Uint8Array>,
  store: CloudStore,
  write: typeof put = put,
  remove: typeof del = del,
) {
  let written = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      written += chunk.length;
      callback(
        written > output.size ? new ConversionError("OUTPUT_TOO_LARGE") : null,
        chunk,
      );
    },
  });
  const stream = Readable.from(source);
  stream.on("error", (error) => meter.destroy(error));
  stream.pipe(meter);
  try {
    await write(output.pathname, meter, {
      access: "private",
      contentType: output.mime,
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: true,
      cacheControlMaxAge: 60,
    });
    if (written !== output.size) throw new ConversionError("INVALID_FILE");
    await store.finish(id, output);
  } finally {
    stream.destroy();
    meter.destroy();
    const current = await store.get(id);
    // Cancellation can delete the prefix while the multipart upload is still
    // committing. Delete that late result rather than leaving an orphan.
    if (
      current?.status !== "succeeded" ||
      current.output?.pathname !== output.pathname
    )
      await remove(output.pathname);
  }
}
