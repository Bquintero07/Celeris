# Build context must be the monorepo root: docker build -f apps/api/Dockerfile .
FROM node:20-slim AS builder
RUN corepack enable
WORKDIR /app

# 1. Copy manifests for layer-cache-friendly install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/tsconfig.build.json ./packages/shared/
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @celeris/api...

# 2. Copy source and build
COPY packages/shared/src ./packages/shared/src
COPY apps/api/src ./apps/api/src
COPY apps/api/prisma ./apps/api/prisma

RUN pnpm --filter @celeris/shared build \
 && pnpm --filter @celeris/api exec prisma generate \
 && pnpm --filter @celeris/api build

# 3. Production image — only runtime files
FROM node:20-slim AS runtime
# Prisma's query engine binary is linked against libssl.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
