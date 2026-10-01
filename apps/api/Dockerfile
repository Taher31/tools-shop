# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/api/Dockerfile .
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

# Full workspace with dev dependencies. Also used as the `tools` image that runs
# migrations and the seed (see the `migrate` service in docker-compose.yml).
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@toolshop/api...
# Self-contained production bundle: dist + pruned node_modules with workspace packages copied in.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter=@toolshop/api deploy --prod --legacy /out/api

FROM build AS tools
WORKDIR /repo/packages/database
CMD ["pnpm", "prisma", "migrate", "deploy"]

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production API_PORT=4000 STORAGE_LOCAL_DIR=/app/uploads
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
