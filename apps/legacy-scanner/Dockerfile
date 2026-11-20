# syntax=docker/dockerfile:1

# Playwright image ships Chromium plus every system library it needs.
# Keep this tag in step with the "playwright" version in pnpm-lock.yaml.
ARG PLAYWRIGHT_VERSION=1.64.1

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ---- dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- runtime ----
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PLAYWRIGHT_CHANNEL=chromium

# Image already has a non-root "pwuser" account.
COPY --from=build --chown=pwuser:pwuser /app/.next/standalone ./
COPY --from=build --chown=pwuser:pwuser /app/.next/static ./.next/static

# Free AI review counts live here; mount a volume so they survive restarts.
RUN mkdir -p /app/data && chown pwuser:pwuser /app/data

USER pwuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Chromium needs more shared memory than Docker's 64 MB default; run with --shm-size=1g
# (or --ipc=host). --init reaps zombie browser processes.
CMD ["node", "server.js"]
