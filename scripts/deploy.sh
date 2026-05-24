#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy VNA NRT Accountant Assistant lên server
#
# Dùng: bash scripts/deploy.sh
# Hoặc: SSH vào server rồi chạy lệnh bên dưới trực tiếp
# =============================================================================
set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

REPO_DIR="${REPO_DIR:-$HOME/VNARPA/vna}"
BRANCH="${BRANCH:-main}"

echo ""
echo -e "${BOLD}════════════════════════════════════════════${NC}"
echo -e "${BOLD} VNA NRT — Deploy to Production${NC}"
echo -e "${BOLD}════════════════════════════════════════════${NC}"
echo ""

# ── 1. Pull latest code ───────────────────────────────────────────────────────
log "Pull code mới nhất từ Git..."
cd "$REPO_DIR"
git fetch origin
git reset --hard origin/$BRANCH
ok "Code đã cập nhật → $(git log --oneline -1)"

# ── 2. Build & restart Docker ─────────────────────────────────────────────────
log "Build Docker image (multi-stage)..."
docker compose build --no-cache

log "Khởi động lại container..."
docker compose up -d

# ── 3. Prisma migration ───────────────────────────────────────────────────────
# NOTE: docker-entrypoint.sh đã tự chạy "cd /app/server && npx prisma db push"
# mỗi khi container khởi động → không cần chạy thủ công ở đây.
# Nếu cần chạy thủ công: docker compose exec -w /app/server app npx prisma db push --accept-data-loss
log "Chờ entrypoint chạy Prisma db push tự động..."
sleep 8

# ── 4. Kiểm tra health ───────────────────────────────────────────────────────
log "Kiểm tra app health..."
sleep 5
HEALTH=$(curl -s --max-time 10 "http://127.0.0.1:3002/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  ok "App healthy!"
else
  warn "App chưa response — xem log: docker compose logs -f app"
fi

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD} ✓ Deploy hoàn thành!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐  https://vnarpa.foxai.com.vn"
echo -e "  📊  https://vnarpa.foxai.com.vn/health"
echo ""
echo -e "  Lệnh hữu ích:"
echo -e "  • Xem log:     ${CYAN}docker compose logs -f app${NC}"
echo -e "  • Xem status:  ${CYAN}docker compose ps${NC}"
echo -e "  • Rollback:    ${CYAN}git reset --hard HEAD~1 && docker compose up -d --build${NC}"
echo ""
