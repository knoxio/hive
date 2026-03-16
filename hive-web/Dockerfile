# Multi-stage build for hive-web frontend
# Uses pnpm for package management

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash bash - \
    && ln -s /root/.local/share/pnpm/pnpm /usr/local/bin/pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Serve with a lightweight static server
FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
