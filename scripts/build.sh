#!/usr/bin/env bash
# =============================================================================
# build.sh — Build toàn bộ project (frontend + backend) cho production
# Chạy từ thư mục gốc của project: bash scripts/build.sh
# =============================================================================
set -e  # Dừng ngay nếu có lệnh lỗi

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${CYAN}[BUILD]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
log "Root: $ROOT_DIR"

# ── 1. Frontend (Vite) ────────────────────────────────────────────────────────
log "Bước 1/4: Cài frontend dependencies..."
npm ci --prefer-offline 2>/dev/null || npm install
ok "Frontend deps OK"

log "Bước 2/4: Build frontend (Vite → dist/)..."
npm run build
ok "Frontend build → dist/"

# ── 2. Backend (TypeScript) ───────────────────────────────────────────────────
log "Bước 3/4: Cài backend dependencies..."
cd "$ROOT_DIR/server"
npm ci --prefer-offline 2>/dev/null || npm install
ok "Backend deps OK"

log "Bước 4/4: Build backend (tsc → server/dist/)..."
npm run build
ok "Backend build → server/dist/"

# ── 3. Prisma ─────────────────────────────────────────────────────────────────
log "Generate Prisma client..."
npx prisma generate
ok "Prisma client generated"

cd "$ROOT_DIR"

# ── 4. Tạo thư mục logs ───────────────────────────────────────────────────────
mkdir -p "$ROOT_DIR/logs"
ok "logs/ directory ready"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN} Build hoàn thành!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Khởi động server:"
echo "  pm2 start ecosystem.config.cjs"
echo "  hoặc: NODE_ENV=production node server/dist/index.js"
echo ""
