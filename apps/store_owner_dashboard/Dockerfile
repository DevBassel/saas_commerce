# syntax=docker/dockerfile:1

# Build from the monorepo root: docker build -f apps/store_owner_dashboard/Dockerfile .

FROM node:20-alpine AS base
RUN npm install -g pnpm@12.4.1
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/store_owner_dashboard/package.json apps/store_owner_dashboard/package.json
COPY apps/super_admin_dashboard/package.json apps/super_admin_dashboard/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /repo ./
COPY . .
RUN pnpm --filter tenant_dash build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve@14
COPY --from=builder /repo/apps/store_owner_dashboard/dist ./dist
USER node
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
