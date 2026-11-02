FROM node:24-bookworm-slim AS base
RUN npm install --global pnpm@11.25.0
ENV PNPM_VERIFY_DEPS_BEFORE_RUN=false
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
COPY apps/docs/package.json ./apps/docs/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS build
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --config.verify-deps-before-run=false --filter web build

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 CONVERSION_DATA_DIR=/data/conversions
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data/conversions && chown -R node:node /data
WORKDIR /app/apps/web

FROM runtime AS web
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]

FROM runtime AS worker
USER root
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libreoffice-writer fonts-noto-cjk fonts-crosextra-carlito fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
USER node
CMD ["node", "scripts/conversion-worker.ts"]
