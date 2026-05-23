# =============================================================================
# Dockerfile — VNA NRT Accountant Assistant
# Multi-stage build: frontend (Vite) + backend (TypeScript) → production image
# Build: docker build -t vna-nrt-app .
# =============================================================================

# ── Stage 1: Build Frontend (Vite) ───────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Cache npm install (chỉ re-install khi package*.json thay đổi)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy toàn bộ frontend source (.dockerignore đã loại node_modules, server/dist, .env)
COPY . .

RUN npm run build
# Output: /app/dist/


# ── Stage 2: Build Backend (TypeScript + Prisma) ─────────────────────────────
FROM node:22-alpine AS backend-builder
WORKDIR /app/server

# Build tools cho bcrypt (native module)
RUN apk add --no-cache python3 make g++ openssl

# Cache npm install
COPY server/package*.json ./
RUN npm ci

# Copy backend source
COPY server/src/     ./src/
COPY server/tsconfig.json ./
COPY server/prisma/  ./prisma/

# Compile TypeScript
RUN npm run build
# Output: /app/server/dist/

# Generate Prisma client (binary đúng cho linux-musl alpine)
RUN npx prisma generate


# ── Stage 3: Production Image ─────────────────────────────────────────────────
FROM node:22-alpine AS production

# dumb-init: xử lý signal đúng cách (PID 1), tránh zombie process
# openssl: cần cho Prisma engine + bcrypt
RUN apk add --no-cache dumb-init openssl curl

WORKDIR /app

# ── Copy backend artifacts ────────────────────────────────────────────────────
COPY --from=backend-builder /app/server/dist         ./server/dist
COPY --from=backend-builder /app/server/node_modules ./server/node_modules
COPY --from=backend-builder /app/server/prisma       ./server/prisma
COPY server/package.json                             ./server/package.json

# ── Copy frontend static files ────────────────────────────────────────────────
COPY --from=frontend-builder /app/dist               ./dist

# ── Startup script ────────────────────────────────────────────────────────────
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── Thư mục dữ liệu (SQLite volume mount vào đây) ────────────────────────────
RUN mkdir -p /app/data /app/logs

# Chạy với user node (không phải root)
RUN chown -R node:node /app
USER node

# ── Runtime environment ───────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=3001
# DATABASE_URL được override qua docker-compose env_file
ENV DATABASE_URL="file:/app/data/app.db"

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -fs http://localhost:3001/health | grep -q '"status":"ok"' || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["/entrypoint.sh"]

LABEL maintainer="foxai.com.vn"
LABEL app="vna-nrt-accountant-assistant"
LABEL version="1.0.0"
