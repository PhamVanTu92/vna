#!/usr/bin/env bash
# =============================================================================
# setup-ubuntu.sh — Cài đặt môi trường production trên Ubuntu 22.04 / 24.04
#
# Chạy với quyền root (hoặc sudo) trên máy chủ Ubuntu mới:
#   sudo bash scripts/setup-ubuntu.sh
#
# Sau khi chạy xong:
#   1. cd /var/www/vna-nrt-app
#   2. Sao chép code lên (git clone hoặc scp)
#   3. Tạo server/.env (xem server/.env.example)
#   4. bash scripts/build.sh
#   5. pm2 start ecosystem.config.cjs
#   6. pm2 save && pm2 startup
# =============================================================================
set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${CYAN}[SETUP]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

# ── Kiểm tra root ─────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "Script này cần chạy với quyền root. Dùng: sudo bash scripts/setup-ubuntu.sh"
fi

APP_DIR="${APP_DIR:-/var/www/vna-nrt-app}"
APP_PORT="${APP_PORT:-3001}"
NODE_VERSION="22"   # LTS

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN} VNA NRT App — Ubuntu Server Setup${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ── 1. Cập nhật hệ thống ──────────────────────────────────────────────────────
log "Cập nhật package list..."
apt-get update -qq
ok "apt-get update"

# ── 2. Cài Node.js (via NodeSource) ──────────────────────────────────────────
log "Cài Node.js ${NODE_VERSION}.x LTS..."
if command -v node &>/dev/null && node -v | grep -q "^v${NODE_VERSION}"; then
  ok "Node.js $(node -v) đã được cài"
else
  apt-get install -y -qq curl ca-certificates
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y -qq nodejs
  ok "Node.js $(node -v) đã cài"
fi

# ── 3. Cài PM2 ────────────────────────────────────────────────────────────────
log "Cài PM2 process manager..."
if command -v pm2 &>/dev/null; then
  ok "PM2 $(pm2 -v) đã được cài"
else
  npm install -g pm2 --silent
  ok "PM2 $(pm2 -v) đã cài"
fi

# ── 4. Cài Nginx (reverse proxy — tuỳ chọn) ──────────────────────────────────
log "Cài Nginx..."
if command -v nginx &>/dev/null; then
  ok "Nginx đã được cài"
else
  apt-get install -y -qq nginx
  ok "Nginx đã cài"
fi

# ── 5. Tạo thư mục app ────────────────────────────────────────────────────────
log "Tạo thư mục $APP_DIR..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"
ok "Directories created"

# ── 6. Tạo Nginx site config ──────────────────────────────────────────────────
log "Tạo Nginx config..."
cat > /etc/nginx/sites-available/vna-nrt-app << NGINX_EOF
server {
    listen 80;
    server_name _;          # Thay bằng domain thật nếu có, VD: vna-nrt.example.com

    # Tăng giới hạn upload (ảnh PDF có thể lớn)
    client_max_body_size 150m;

    # Proxy tất cả request đến Node.js app
    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeout cho OCR (có thể mất vài giây)
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1024;
}
NGINX_EOF

# Kích hoạt site
ln -sf /etc/nginx/sites-available/vna-nrt-app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "Nginx config created & reloaded"

# ── 7. Mở firewall (ufw) ─────────────────────────────────────────────────────
log "Cấu hình firewall..."
if command -v ufw &>/dev/null; then
  ufw allow 'Nginx HTTP' 2>/dev/null || true
  ufw allow 'Nginx HTTPS' 2>/dev/null || true
  ufw allow OpenSSH 2>/dev/null || true
  ok "UFW rules updated"
else
  warn "ufw không tìm thấy — bỏ qua firewall config"
fi

# ── 8. Tạo file .env mẫu ─────────────────────────────────────────────────────
if [[ ! -f "$APP_DIR/server/.env" ]]; then
  mkdir -p "$APP_DIR/server"
  cat > "$APP_DIR/server/.env" << ENV_EOF
# ============================================
# VNA NRT App — Production Environment
# Điền giá trị thật vào các biến bên dưới
# ============================================

# Gemini API Key (lấy từ Google AI Studio)
GEMINI_API_KEY=PASTE_YOUR_REAL_GEMINI_API_KEY_HERE

# JWT secret — đổi thành chuỗi ngẫu nhiên dài >= 64 ký tự
# Tạo bằng: openssl rand -base64 64
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET_STRING

# Database
DATABASE_URL="file:./dev.db"

# Server port (Nginx sẽ proxy vào đây)
PORT=${APP_PORT}
ENV_EOF
  warn "Đã tạo $APP_DIR/server/.env — Nhớ điền GEMINI_API_KEY và JWT_SECRET thật!"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN} Setup hoàn thành!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${YELLOW}BƯỚC TIẾP THEO:${NC}"
echo ""
echo "1. Đưa code lên server:"
echo "   git clone <your-repo-url> $APP_DIR"
echo "   # hoặc: scp -r ./* user@server:$APP_DIR/"
echo ""
echo "2. Sửa file môi trường:"
echo "   nano $APP_DIR/server/.env"
echo "   # Điền GEMINI_API_KEY và JWT_SECRET thật"
echo ""
echo "3. Build và khởi động:"
echo "   cd $APP_DIR"
echo "   bash scripts/build.sh"
echo "   pm2 start ecosystem.config.cjs"
echo ""
echo "4. Tự khởi động khi server reboot:"
echo "   pm2 save"
echo "   pm2 startup    # copy & paste lệnh nó in ra"
echo ""
echo "5. Tạo license key đầu tiên (trên máy dev, không phải server):"
echo "   cd tools && node generate-license.js \\"
echo "     --customer-id vna-nrt-001 \\"
echo "     --customer-name 'Vietnam Airlines NRT' \\"
echo "     --expires 2027-12-31 \\"
echo "     --max-users 50"
echo ""
echo "6. Xem log:"
echo "   pm2 logs vna-nrt-app"
echo ""
