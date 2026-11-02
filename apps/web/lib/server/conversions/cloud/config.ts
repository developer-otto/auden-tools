import { ConversionError, type Capabilities } from "../../../conversions.ts";

export function cloudMode() {
  // Never silently fall back to a local database on Vercel's ephemeral filesystem.
  return (
    process.env.VERCEL === "1" || process.env.CONVERSION_BACKEND === "vercel"
  );
}

export function cloudCapabilities(): Capabilities {
  const online = Boolean(
    process.env.DATABASE_URL &&
    process.env.BLOB_READ_WRITE_TOKEN &&
    process.env.CONVERSION_SANDBOX_IMAGE,
  );
  return { online, office: online, ffmpeg: online, upload: "blob" };
}

export function requireCloud() {
  if (!cloudMode() || !cloudCapabilities().online)
    throw new ConversionError("ENGINE_UNAVAILABLE");
}

export function sandboxCredentials() {
  // Production uses the deployment's short-lived OIDC credentials automatically.
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  return !process.env.VERCEL && token && teamId && projectId
    ? { token, teamId, projectId }
    : {};
}
