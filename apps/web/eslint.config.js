import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    ignores: [
      ".data/**",
      ".local-tools/**",
      ".workflow-data/**",
      "app/.well-known/workflow/**",
    ],
  },
  {
    rules: {
      "turbo/no-undeclared-env-vars": [
        "warn",
        {
          allowList: [
            "CONVERSION_DATA_DIR",
            "FFMPEG_PATH",
            "FFPROBE_PATH",
            "LIBREOFFICE_PATH",
            "APP_ORIGIN",
            "CONVERSION_BACKEND",
            "CONVERSION_SANDBOX_IMAGE",
            "DATABASE_URL",
            "BLOB_READ_WRITE_TOKEN",
            "VERCEL",
            "VERCEL_TOKEN",
            "VERCEL_TEAM_ID",
            "VERCEL_PROJECT_ID",
            "CRON_SECRET",
          ],
        },
      ],
    },
  },
];
