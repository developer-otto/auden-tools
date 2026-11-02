import {
  copy,
  del,
  head,
  issueSignedToken,
  list,
  presignUrl,
} from "@vercel/blob";
import { ConversionError } from "../../../conversions.ts";
import { jobPrefix, type CloudJob } from "./model.ts";

export async function verifyUploads(job: CloudJob) {
  for (const input of job.inputs) {
    let file;
    try {
      file = await head(input.pathname);
    } catch {
      throw new ConversionError("UPLOAD_FAILED");
    }
    if (file.pathname !== input.pathname || file.size !== input.size)
      throw new ConversionError("INVALID_FILE");
  }
}

export async function copyInputs(from: CloudJob, to: CloudJob) {
  for (let i = 0; i < from.inputs.length; i++) {
    await copy(from.inputs[i]!.pathname, to.inputs[i]!.pathname, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 60,
    });
  }
  await verifyUploads(to);
}

export async function signedInput(pathname: string) {
  const validUntil = Date.now() + 5 * 60 * 1000;
  const token = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
  });
  return (
    await presignUrl(token, {
      pathname,
      operation: "get",
      access: "private",
      validUntil,
      useCache: false,
    })
  ).presignedUrl;
}

export async function deleteJobBlobs(id: string) {
  const prefix = jobPrefix(id);
  // Delete one page at a time. Query again from the beginning after deletion so
  // continuation tokens cannot skip objects when the collection changes.
  for (;;) {
    const page = await list({ prefix, limit: 100 });
    if (!page.blobs.length) return;
    await del(page.blobs.map((blob) => blob.pathname));
  }
}
