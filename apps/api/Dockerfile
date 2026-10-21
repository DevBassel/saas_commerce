# ── Stage 1: Install ALL deps & build ────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm --activate

WORKDIR /app

# Copy only the API package.json (no monorepo files)
COPY package.json ./
COPY static ./static

# Allow native build scripts (bcrypt, etc.) — mirrors root pnpm-workspace.yaml allowBuilds
RUN printf 'allowBuilds:\n  "@nestjs/core": true\n  "@parcel/watcher": true\n  "@scarf/scarf": true\n  bcrypt: true\n  unrs-resolver: true\n' > pnpm-workspace.yaml

# Install all deps (including devDependencies for the build step).
RUN pnpm install --no-frozen-lockfile

# Copy source & config files
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ src/

# Build the NestJS project → dist/
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN pnpm run build

CMD ["node", "dist/main"]
