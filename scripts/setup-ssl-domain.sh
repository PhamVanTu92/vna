#!/usr/bin/env bash
# =============================================================================
# setup-ssl-domain.sh — Cấu hình Nginx + SSL (Let's Encrypt) cho domain
#
# Domain mặc định: vnarpa.foxai.com.vn
# App chạy trong Docker tại: 127.0.0.1:3002 (host port)
#
# Yêu cầu:
#   - Ubuntu 22.04 / 24.04
#   - Nginx đã cài và đang chạy (server này đã có sẵn)
#   - DNS: A record vnarpa.foxai.com.vn → IP server này đã được trỏ
#   - Docker container đang chạy (docker compose up -d)
#   - Chạy với quyền root: sudo bash scripts/setup-ssl-domain.sh
# =============================================================================
set -e

DOMAIN="${DOMAIN:-vnarpa.foxai.com.vn}"
APP_PORT="${APP_PORT:-3002}"
EMAIL="${EMAIL:-admin@foxai.com.vn}"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${CYAN}[SSL]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && err "Cần quyền root: sudo bash scripts/setup-ssl-domain.sh"

echo ""
echo -e "${BOLD}════════════════════════════════════════════${NC}"
echo -e "${BOLD} Nginx + SSL Setup cho ${CYAN}${DOMAIN}${NC}"
echo -e "${BOLD}════════════════════════════════════════════${NC}"
echo ""

# ── 1. Kiểm tra Nginx ─────────────────────────────────────────────────────────
log "Kiểm tra Nginx..."
if ! command -v nginx &>/dev/null; then
  log "Cài Nginx..."
  apt-get update -qq && apt-get install -y -qq nginx
fi

# Không gọi start/restart — chỉ kiểm tra trạng thái
if systemctl is-active --quiet nginx; then
  ok "Nginx đang chạy: $(nginx -v 2>&1)"
else
  log "Nginx chưa chạy, khởi động..."
  systemctl enable nginx --quiet
  systemctl start nginx
  ok "Nginx started"
fi

# ── 2. Cài Certbot ────────────────────────────────────────────────────────────
log "Kiểm tra / cài Certbot..."
if ! command -v certbot &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx
fi
ok "Certbot: $(certbot --version 2>&1)"

# ── 3. Kiểm tra DNS ───────────────────────────────────────────────────────────
log "Kiểm tra DNS cho ${DOMAIN}..."
SERVER_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null \
         || curl -s --max-time 5 http://checkip.amazonaws.com 2>/dev/null \
         || echo "unknown")
DNS_IP=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' \
      || dig +short "$DOMAIN" 2>/dev/null | tail -1 \
      || echo "")

echo "  Server IP (public): ${SERVER_IP}"
echo "  DNS IP for domain:  ${DNS_IP:-không resolve được}"

if [[ -n "$DNS_IP" && "$DNS_IP" == "$SERVER_IP" ]]; then
  ok "DNS trỏ đúng!"
else
  warn "DNS chưa verify được (IP: ${DNS_IP:-N/A} ≠ ${SERVER_IP})"
  warn "Certbot sẽ FAIL nếu domain chưa trỏ về server này."
  echo ""
  read -rp "  Tiếp tục? [y/N] " yn
  [[ "$yn" != "y" && "$yn" != "Y" ]] && err "Dừng lại — hãy cấu hình DNS A record trước."
fi

# ── 4. Tạo Nginx config HTTP-ONLY ─────────────────────────────────────────────
# QUAN TRỌNG: Chỉ HTTP trước — certbot sẽ tự thêm HTTPS block sau
# Không đưa SSL paths vào đây vì cert chưa tồn tại → nginx -t sẽ fail
log "Tạo Nginx HTTP config cho ${DOMAIN}..."

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

cat > "$NGINX_CONF" << NGINXEOF
# ${DOMAIN} — HTTP only (certbot sẽ tự thêm HTTPS block bên dưới)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 150m;

    # Cho phép certbot verify domain qua webroot
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    # Proxy tất cả request đến Docker app
    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout    120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout    120s;
    }
}
NGINXEOF

mkdir -p /var/www/certbot

# Kích hoạt site
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"

# Test config và reload — phải pass vì chỉ có HTTP
log "Test và reload Nginx (HTTP only)..."
nginx -t || err "Nginx config test thất bại! Kiểm tra: nginx -t"
systemctl reload nginx
ok "Nginx reload OK — site HTTP đang hoạt động"

# ── 5. Cấp SSL certificate ────────────────────────────────────────────────────
log "Cấp SSL certificate cho ${DOMAIN}..."
echo "  Email: ${EMAIL}"
echo ""

if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  warn "Cert đã tồn tại → chạy renew"
  certbot renew --nginx --cert-name "$DOMAIN" --non-interactive
else
  # certbot --nginx tự động:
  # 1. Verify domain ownership qua HTTP-01 challenge
  # 2. Download cert
  # 3. Chỉnh sửa nginx config — thêm HTTPS server block + redirect
  certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect
fi

ok "SSL certificate OK!"

# ── 6. Thêm security headers và gzip vào HTTPS block do certbot tạo ──────────
# certbot đã tạo HTTPS block — chỉ reload lại để chắc chắn
log "Final reload Nginx với SSL config..."
nginx -t || err "Nginx config có lỗi sau certbot. Kiểm tra: nginx -t"
systemctl reload nginx
ok "Nginx reloaded với HTTPS"

# ── 7. Kiểm tra app ───────────────────────────────────────────────────────────
log "Kiểm tra Docker app trên port ${APP_PORT}..."
HEALTH=$(curl -s --max-time 5 "http://127.0.0.1:${APP_PORT}/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  ok "App healthy!"
else
  warn "App chưa response tại port ${APP_PORT}."
  warn "Đảm bảo container đang chạy: cd ~/VNARPA/vna && docker compose up -d"
fi

# ── 8. Auto-renew cronjob ─────────────────────────────────────────────────────
log "Cấu hình auto-renew SSL..."
CRON_JOB="0 3,15 * * * certbot renew --quiet --nginx --post-hook 'systemctl reload nginx'"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB") | crontab -
ok "Cron: certbot renew chạy lúc 3:00 và 15:00 hằng ngày"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD} ✓ Domain setup hoàn thành!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐  https://${DOMAIN}"
echo -e "  📊  https://${DOMAIN}/health"
echo ""
echo -e "  Lệnh hữu ích:"
echo -e "  • Log app:       ${CYAN}docker compose logs -f app${NC}"
echo -e "  • Reload nginx:  ${CYAN}systemctl reload nginx${NC}"
echo -e "  • Test SSL:      ${CYAN}curl -I https://${DOMAIN}${NC}"
echo -e "  • Renew test:    ${CYAN}certbot renew --dry-run${NC}"
echo ""
