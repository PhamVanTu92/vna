#!/bin/sh
# =============================================================================
# docker-entrypoint.sh — Container startup script
# Chạy tự động khi container khởi động
# =============================================================================
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo "${CYAN}[INIT]${NC} $1"; }
ok()   { echo "${GREEN}[OK]${NC} $1"; }
err()  { echo "${RED}[ERR]${NC} $1"; exit 1; }

echo ""
echo "==============================="
echo " VNA NRT App — Starting..."
echo "==============================="
echo ""

# ── Kiểm tra biến môi trường bắt buộc ────────────────────────────────────────
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "PASTE_YOUR_REAL_GEMINI_API_KEY_HERE" ]; then
  echo "[WARN] GEMINI_API_KEY chưa được cấu hình!"
fi

if [ -z "$JWT_SECRET" ] || echo "$JWT_SECRET" | grep -q "CHANGE_THIS"; then
  echo "[WARN] JWT_SECRET đang dùng giá trị mặc định — không an toàn trong production!"
fi

# ── Tạo thư mục data nếu chưa có ─────────────────────────────────────────────
log "Preparing data directory..."
mkdir -p /app/data
ok "Data dir: /app/data"

# ── Prisma: tạo/cập nhật DB schema ───────────────────────────────────────────
log "Applying database schema..."
cd /app/server

# prisma db push: an toàn cho SQLite — tạo schema nếu chưa có, bảo toàn data
npx prisma db push --accept-data-loss 2>&1 | tail -5

ok "Database schema ready"
cd /app

# ── Khởi động Node.js server ──────────────────────────────────────────────────
log "Starting Express server on port ${PORT:-3001}..."
echo ""

exec node /app/server/dist/index.js
