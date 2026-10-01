# syntax=docker/dockerfile:1

# Production image for the public storefront.
# Build from the monorepo root: docker build -f apps/tenant_store/Dockerfile .
FROM node:22-alpine AS base
RUN npm install -g pnpm@12.4.1
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
# Vite/Next inline NEXT_PUBLIC_* at build time, so they arrive as build args.
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_APP_ROOT_DOMAIN
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_APP_ROOT_DOMAIN=$NEXT_PUBLIC_APP_ROOT_DOMAIN \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_STANDALONE=1
COPY --from=deps /repo ./
COPY . .
RUN pnpm --filter tenant_store build

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0
# Standalone output is traced from the repo root, so it nests under
# apps/tenant_store and carries the workspace node_modules alongside it.
COPY --from=builder --chown=node:node /repo/apps/tenant_store/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/tenant_store/.next/static ./apps/tenant_store/.next/static
COPY --from=builder --chown=node:node /repo/apps/tenant_store/public ./apps/tenant_store/public
USER node
EXPOSE 3000
CMD ["node", "apps/tenant_store/server.js"]
