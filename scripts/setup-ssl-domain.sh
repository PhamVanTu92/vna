#!/usr/bin/env bash
# =============================================================================
# setup-ssl-domain.sh — Cấu hình Nginx + SSL (Let's Encrypt) cho domain
#
# Domain mặc định: vnarpa.foxai.com.vn
# App chạy trong Docker tại: 127.0.0.1:3002 (host port)
#
# Yêu cầu:
#   - Ubuntu 22.04 / 24.04
#   - DNS: A record vnarpa.foxai.com.vn → IP server này đã được trỏ
#   - Docker container đang chạy (docker compose up -d)
#   - Chạy với quyền root: sudo bash scripts/setup-ssl-domain.sh
# =============================================================================
set -e

DOMAIN="${DOMAIN:-vnarpa.foxai.com.vn}"
APP_PORT="${APP_PORT:-3002}"   # host port (3000+3001 đã bị chiếm bởi project khác)
EMAIL="${EMAIL:-admin@foxai.com.vn}"   # Email nhận thông báo hết hạn SSL

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${CYAN}[SSL]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

# ── Kiểm tra root ─────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Cần quyền root: sudo bash scripts/setup-ssl-domain.sh"

echo ""
echo -e "${BOLD}════════════════════════════════════════════${NC}"
echo -e "${BOLD} Nginx + SSL Setup cho ${CYAN}${DOMAIN}${NC}"
echo -e "${BOLD}════════════════════════════════════════════${NC}"
echo ""

# ── 1. Cài Nginx ──────────────────────────────────────────────────────────────
log "Kiểm tra / cài Nginx..."
if ! command -v nginx &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq nginx
fi
systemctl enable nginx --quiet
systemctl start nginx
ok "Nginx ready: $(nginx -v 2>&1)"

# ── 2. Cài Certbot ────────────────────────────────────────────────────────────
log "Kiểm tra / cài Certbot (Let's Encrypt)..."
if ! command -v certbot &>/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx
fi
ok "Certbot: $(certbot --version 2>&1)"

# ── 3. Kiểm tra DNS ───────────────────────────────────────────────────────────
log "Kiểm tra DNS resolution cho ${DOMAIN}..."
SERVER_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || curl -s --max-time 5 http://checkip.amazonaws.com 2>/dev/null || echo "unknown")
DNS_IP=$(getent hosts "$DOMAIN" | awk '{ print $1 }' || dig +short "$DOMAIN" 2>/dev/null | tail -1 || echo "")

echo "  Server IP (public): ${SERVER_IP}"
echo "  DNS IP for domain:  ${DNS_IP:-không resolve được}"

if [[ -n "$DNS_IP" && "$DNS_IP" == "$SERVER_IP" ]]; then
  ok "DNS trỏ đúng về server này!"
elif [[ -z "$DNS_IP" ]]; then
  warn "Không resolve được domain. Đảm bảo đã tạo A record:"
  echo "      ${DOMAIN}  →  ${SERVER_IP}"
  echo ""
  read -p "  Tiếp tục dù chưa verify DNS? [y/N] " yn
  [[ "$yn" != "y" && "$yn" != "Y" ]] && err "Dừng lại. Hãy cấu hình DNS trước."
else
  warn "DNS IP (${DNS_IP}) khác server IP (${SERVER_IP})."
  warn "SSL sẽ FAIL nếu DNS chưa trỏ đúng. Certbot cần domain resolve về server này."
  echo ""
  read -p "  Tiếp tục? [y/N] " yn
  [[ "$yn" != "y" && "$yn" != "Y" ]] && err "Dừng lại."
fi

# ── 4. Tạo Nginx site config (HTTP — cần để certbot verify) ──────────────────
log "Tạo Nginx config cho ${DOMAIN}..."

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

cat > "$NGINX_CONF" << NGINXEOF
# ──────────────────────────────────────────────────────────────────────────────
# Nginx config: ${DOMAIN}
# App: Node.js / Docker trên 127.0.0.1:${APP_PORT}
# SSL: Let's Encrypt (tự động gia hạn)
# ──────────────────────────────────────────────────────────────────────────────

# Redirect HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS — proxy đến Docker app
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${DOMAIN};

    # ── SSL (certbot sẽ điền/cập nhật tự động) ────────────────────────────────
    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # ── Security headers ──────────────────────────────────────────────────────
    add_header X-Frame-Options           "SAMEORIGIN"   always;
    add_header X-Content-Type-Options    "nosniff"      always;
    add_header X-XSS-Protection          "1; mode=block" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # ── Upload limit (PDF OCR có thể lớn) ─────────────────────────────────────
    client_max_body_size 150m;

    # ── Proxy → Docker app ────────────────────────────────────────────────────
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

        # Timeout dài hơn cho OCR (Gemini API)
        proxy_read_timeout    120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout    120s;
    }

    # ── Gzip ──────────────────────────────────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml image/svg+xml;
    gzip_min_length 1024;

    # ── Logging ───────────────────────────────────────────────────────────────
    access_log /var/log/nginx/${DOMAIN}-access.log;
    error_log  /var/log/nginx/${DOMAIN}-error.log  warn;
}
NGINXEOF

# Kích hoạt site (KHÔNG xóa default — server đang chạy nhiều project)
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"

# Tạo thư mục certbot webroot
mkdir -p /var/www/certbot

# Test config và reload
nginx -t
systemctl reload nginx
ok "Nginx config created & reloaded"

# ── 5. Cấp SSL certificate ────────────────────────────────────────────────────
log "Cấp SSL certificate cho ${DOMAIN}..."
echo "  Email: ${EMAIL}"
echo ""

# Kiểm tra nếu cert đã tồn tại
if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  warn "Cert đã tồn tại! Chạy renew thay vì cấp mới."
  certbot renew --nginx --cert-name "$DOMAIN" --non-interactive
else
  # Cấp cert mới
  certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect \
    --hsts \
    --staple-ocsp
fi

ok "SSL certificate issued!"

# ── 6. Test reload Nginx sau khi certbot cập nhật config ─────────────────────
nginx -t && systemctl reload nginx
ok "Nginx reloaded with SSL config"

# ── 7. Verify app đang chạy ───────────────────────────────────────────────────
log "Kiểm tra app health..."
HEALTH=$(curl -s --max-time 5 "http://127.0.0.1:${APP_PORT}/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  ok "App đang chạy và healthy!"
else
  warn "App chưa response tại port ${APP_PORT}. Đảm bảo Docker container đang chạy:"
  echo "   docker compose up -d"
fi

# ── 8. Auto-renew (cronjob) ───────────────────────────────────────────────────
log "Cấu hình auto-renew SSL (certbot renew 2 lần/ngày)..."
CRON_JOB="0 3,15 * * * certbot renew --quiet --nginx --post-hook 'systemctl reload nginx'"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB") | crontab -
ok "Cron job added: chạy 3:00 và 15:00 mỗi ngày"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD} ✓ Domain setup hoàn thành!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐 URL:     ${BOLD}https://${DOMAIN}${NC}"
echo -e "  🔒 SSL:     Let's Encrypt (tự động gia hạn)"
echo -e "  📊 Health:  https://${DOMAIN}/health"
echo ""
echo -e "  Lệnh hữu ích:"
echo -e "  • Xem log app:   ${CYAN}docker compose logs -f app${NC}"
echo -e "  • Reload nginx:  ${CYAN}systemctl reload nginx${NC}"
echo -e "  • Test SSL:      ${CYAN}curl -I https://${DOMAIN}${NC}"
echo -e "  • Renew cert:    ${CYAN}certbot renew --dry-run${NC}"
echo ""
