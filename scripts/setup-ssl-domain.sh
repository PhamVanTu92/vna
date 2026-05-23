#!/usr/bin/env bash
# =============================================================================
# setup-ssl-domain.sh — Cấu hình Nginx + SSL (Let's Encrypt) cho domain
#
# Domain mặc định: vnarpa.foxai.com.vn
# App chạy trong Docker tại: 127.0.0.1:3002 (host port)
#
# Dùng certbot certonly --webroot (KHÔNG dùng --nginx plugin)
# vì server này nginx không qua systemd — certbot --nginx sẽ restart nginx
# mới → bind() failed vì ports đã bị giữ bởi nginx cũ.
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

# ── Hàm reload nginx — KHÔNG restart, chỉ SIGHUP master process ──────────────
nginx_reload() {
  local master_pid
  master_pid=$(ps aux | awk '/nginx: master process/{print $2}' | head -1)
  if [[ -n "$master_pid" ]]; then
    kill -HUP "$master_pid"
    sleep 1
    ok "Nginx reloaded (kill -HUP pid=$master_pid)"
    return 0
  fi
  # Fallback: nginx -s reload dùng pid file
  if nginx -s reload 2>/dev/null; then
    ok "Nginx reloaded (nginx -s reload)"
    return 0
  fi
  err "Không reload được nginx. Thử thủ công: kill -HUP \$(ps aux | awk '/nginx: master/{print \$2}' | head -1)"
}

# ── 1. Kiểm tra Nginx ─────────────────────────────────────────────────────────
log "Kiểm tra Nginx..."
command -v nginx &>/dev/null || { apt-get update -qq && apt-get install -y -qq nginx; }

if pgrep -x nginx > /dev/null 2>&1; then
  ok "Nginx đang chạy: $(nginx -v 2>&1)"
else
  warn "Nginx chưa chạy — thử khởi động..."
  nginx || err "Không khởi động được nginx"
  ok "Nginx started"
fi

# ── 2. Cài Certbot (certbot-only, KHÔNG cài nginx plugin) ─────────────────────
log "Kiểm tra / cài Certbot..."
if ! command -v certbot &>/dev/null; then
  apt-get update -qq
  # Chỉ cài certbot thuần, không cần python3-certbot-nginx
  apt-get install -y -qq certbot
fi
ok "Certbot: $(certbot --version 2>&1)"

# ── 3. Kiểm tra DNS ───────────────────────────────────────────────────────────
log "Kiểm tra DNS cho ${DOMAIN}..."
SERVER_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null \
         || curl -s --max-time 5 http://checkip.amazonaws.com 2>/dev/null \
         || echo "unknown")
DNS_IP=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' \
      || dig +short "$DOMAIN" 2>/dev/null | grep -v '\.$' | tail -1 \
      || echo "")

echo "  Server IP (public): ${SERVER_IP}"
echo "  DNS IP for domain:  ${DNS_IP:-không resolve được}"

if [[ -n "$DNS_IP" && "$DNS_IP" == "$SERVER_IP" ]]; then
  ok "DNS trỏ đúng!"
else
  warn "DNS chưa khớp (resolve: ${DNS_IP:-N/A} | server: ${SERVER_IP})"
  warn "Certbot FAIL nếu domain chưa trỏ về server này."
  echo ""
  read -rp "  Tiếp tục? [y/N] " yn
  [[ "$yn" != "y" && "$yn" != "Y" ]] && err "Dừng lại."
fi

# ── 4. Nginx config HTTP-ONLY (cho certbot webroot challenge) ─────────────────
log "Tạo Nginx HTTP config..."
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
mkdir -p /var/www/certbot

cat > "$NGINX_CONF" << NGINXEOF
# ${DOMAIN} — HTTP only (HTTPS block sẽ được thêm sau khi có cert)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    client_max_body_size 150m;

    # Certbot webroot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout    120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout    120s;
    }
}
NGINXEOF

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"
nginx -t || err "Nginx config lỗi! Kiểm tra: nginx -t"
nginx_reload
ok "HTTP config active"

# ── 5. Cấp SSL cert dùng --webroot (KHÔNG --nginx, KHÔNG restart nginx) ───────
log "Cấp SSL certificate (webroot mode)..."
echo "  Email : ${EMAIL}"
echo "  Domain: ${DOMAIN}"
echo ""

if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  warn "Cert đã tồn tại → renew"
  certbot renew \
    --webroot -w /var/www/certbot \
    --cert-name "$DOMAIN" \
    --non-interactive \
    --quiet
else
  # certonly + webroot: lấy cert mà KHÔNG đụng vào nginx process
  certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL"
fi

CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
[[ -f "${CERT_DIR}/fullchain.pem" ]] || err "Cert không tồn tại sau khi certbot chạy!"
ok "SSL certificate OK → ${CERT_DIR}"

# ── 6. Viết lại nginx config với HTTPS (cert đã có) ──────────────────────────
log "Viết Nginx HTTPS config..."

cat > "$NGINX_CONF" << NGINXEOF
# ${DOMAIN} — HTTP redirect + HTTPS proxy

# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${DOMAIN};

    # SSL cert (Let's Encrypt)
    ssl_certificate     ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;

    # SSL hardening
    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_ciphers               ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       1d;
    ssl_session_tickets       off;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options           "SAMEORIGIN"                          always;
    add_header X-Content-Type-Options    "nosniff"                             always;

    client_max_body_size 150m;

    # Proxy → Docker app
    location / {
        proxy_pass         http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout    120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout    120s;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1024;

    access_log /var/log/nginx/${DOMAIN}-access.log;
    error_log  /var/log/nginx/${DOMAIN}-error.log warn;
}
NGINXEOF

# Test và reload — KHÔNG restart
nginx -t || err "Nginx HTTPS config lỗi! Kiểm tra: nginx -t"
nginx_reload
ok "HTTPS config active"

# ── 7. Kiểm tra app ───────────────────────────────────────────────────────────
log "Kiểm tra app health..."
HEALTH=$(curl -s --max-time 5 "http://127.0.0.1:${APP_PORT}/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  ok "App healthy!"
else
  warn "App chưa response tại port ${APP_PORT}."
  warn "Khởi động Docker: cd ~/VNARPA/vna && docker compose up -d"
fi

# ── 8. Auto-renew cronjob (dùng webroot, KHÔNG --nginx) ──────────────────────
log "Cấu hình auto-renew SSL..."
MASTER_PID_CMD='kill -HUP $(ps aux | awk "/nginx: master process/{print \$2}" | head -1)'
CRON_JOB="0 3,15 * * * certbot renew --webroot -w /var/www/certbot --quiet --post-hook '${MASTER_PID_CMD}'"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB") | crontab -
ok "Cron: certbot renew lúc 3:00 và 15:00 hằng ngày"

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
echo -e "  • Reload nginx:  ${CYAN}kill -HUP \$(ps aux | awk '/nginx: master/{print \$2}' | head -1)${NC}"
echo -e "  • Test SSL:      ${CYAN}curl -I https://${DOMAIN}${NC}"
echo -e "  • Renew test:    ${CYAN}certbot renew --dry-run --webroot -w /var/www/certbot${NC}"
echo ""
