# syntax=docker/dockerfile:1

# Development image: runs the NestJS API in watch mode.
# Alpine-based (glibc) so the bcrypt prebuilt binaries resolve without a toolchain.
FROM node:26-alpine

ENV NODE_ENV=development \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN npm install --global pnpm@10.34.5

WORKDIR /app

# Dependency layer: only re-installs when the manifests change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

# Source is bind-mounted by compose at runtime; this keeps the image usable standalone.
COPY . .

EXPOSE 4000

CMD ["pnpm", "run", "start:dev"]
