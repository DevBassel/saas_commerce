# syntax=docker/dockerfile:1

# Development image: runs the NestJS API in watch mode.
# Alpine-based (glibc) so the bcrypt prebuilt binaries resolve without a toolchain.
# Build from the monorepo root: docker build -f apps/api/Dockerfile .
FROM node:26-alpine

ENV NODE_ENV=development \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN npm install --global pnpm@12.4.1

WORKDIR /repo

# Dependency layer: root manifests plus every workspace manifest, so a change to
# any workspace invalidates the install cache.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/store_owner_dashboard/package.json apps/store_owner_dashboard/package.json
COPY apps/super_admin_dashboard/package.json apps/super_admin_dashboard/package.json

RUN pnpm install --frozen-lockfile

# Source is bind-mounted by compose at runtime; this keeps the image usable standalone.
COPY . .

WORKDIR /repo/apps/api

EXPOSE 4000

CMD ["pnpm", "dev"]
