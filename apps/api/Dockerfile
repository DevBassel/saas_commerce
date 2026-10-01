# syntax=docker/dockerfile:1

# Production image: compiles the NestJS API and runs the compiled output.
# Build from the monorepo root: docker build -f apps/api/Dockerfile .
# Debian (glibc) base so bcrypt prebuilt binaries resolve without a toolchain.
FROM node:26-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN npm install --global pnpm@12.4.1
WORKDIR /repo

# Dependency layer: root manifests plus every workspace manifest (including
# tenant_store), so a change to any workspace invalidates the install cache.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/store_owner_dashboard/package.json apps/store_owner_dashboard/package.json
COPY apps/super_admin_dashboard/package.json apps/super_admin_dashboard/package.json
COPY apps/tenant_store/package.json apps/tenant_store/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /repo ./
COPY . .
RUN pnpm --filter saas_store_api build

FROM base AS runner
ENV NODE_ENV=production
# Repeat the frozen install so the workspace module layout produced under /repo
# is identical to the builder's (same manifests, production dependencies only).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/store_owner_dashboard/package.json apps/store_owner_dashboard/package.json
COPY apps/super_admin_dashboard/package.json apps/super_admin_dashboard/package.json
COPY apps/tenant_store/package.json apps/tenant_store/package.json
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /repo/apps/api/dist apps/api/dist
# The API creates rotating log files under process.cwd()/logs at boot
# (AppLoggerModule / TypeOrmDailyLogger). Pre-create the directory owned by the
# non-root user so startup does not fail with EACCES.
RUN mkdir -p /repo/logs && chown node:node /repo/logs
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main"]
