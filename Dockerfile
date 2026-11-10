# Image of the static PWA: bun builds it, nginx (unprivileged, port 8080) serves it.
# Base digests resolved on 2026-11-10: oven/bun:1 (bun 1.4.4) and nginxinc/nginx-unprivileged:1.30-alpine (multi-arch index digest).
FROM oven/bun:1@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG GIT_SHA
RUN case "$GIT_SHA" in *[!0-9a-f]* | '') echo "GIT_SHA must be a 40-character hex sha" >&2; exit 1 ;; esac \
    && [ "${#GIT_SHA}" = 40 ] \
    && bun run build \
    && bun scripts/write-health.mjs "$GIT_SHA"

FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
