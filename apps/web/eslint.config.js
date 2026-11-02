import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    ignores: [
      "public/conversion/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  {
    rules: {
      "turbo/no-undeclared-env-vars": [
        "warn",
        {
          allowList: [
            "PLAYWRIGHT_BASE_URL",
            "PLAYWRIGHT_CHANNEL",
            "CI",
            "NO_PROXY",
          ],
        },
      ],
    },
  },
];
