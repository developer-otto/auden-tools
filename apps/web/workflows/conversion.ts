import { sleep } from "workflow";
import {
  inspectUpload,
  prepareConversion,
  tickConversion,
  failConversion,
  releaseSandbox,
  cleanupAt,
  purgeConversion,
} from "./conversion-steps";

export async function conversionWorkflow(id: string) {
  "use workflow";
  console.info("conversion.started", { id });
  try {
    let state = await inspectUpload(id);
    while (state === "waiting") {
      await sleep("5s");
      state = await inspectUpload(id);
    }
    if (state === "ready") {
      await prepareConversion(id);
      while (await tickConversion(id)) await sleep("5s");
    }
  } catch {
    await failConversion(id);
  } finally {
    await releaseSandbox(id);
    const expires = await cleanupAt(id);
    if (expires) {
      await sleep(new Date(expires));
      await purgeConversion(id);
    }
    console.info("conversion.cleaned", { id });
  }
}
