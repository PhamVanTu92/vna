#!/usr/bin/env bash
# =============================================================================
# check-ports.sh — Kiểm tra ports đang dùng trên server
# Dùng trước khi deploy để tránh xung đột giữa các project
#
# Cách dùng:
#   bash scripts/check-ports.sh          # kiểm tra tất cả
#   bash scripts/check-ports.sh 3001     # kiểm tra port cụ thể
#   bash scripts/check-ports.sh 80 443 3001 3000
# =============================================================================

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
log()   { echo -e "${CYAN}▶${NC} $1"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
used()  { echo -e "  ${RED}✗ ĐANG DÙNG${NC} — $1"; }
free()  { echo -e "  ${GREEN}✓ FREE${NC}     — port $1"; }

# ── Ports VNA NRT app cần ─────────────────────────────────────────────────────
DEFAULT_PORTS=(3001 80 443)

PORTS_TO_CHECK=("${@:-${DEFAULT_PORTS[@]}}")

echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo -e "${BOLD} Port Checker — VNA NRT App${NC}"
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""

# ── Hàm kiểm tra port ─────────────────────────────────────────────────────────
check_port() {
  local port=$1
  local result

  # Ưu tiên ss (nhanh hơn), fallback về netstat, rồi lsof
  if command -v ss &>/dev/null; then
    result=$(ss -tlnp "sport = :${port}" 2>/dev/null | grep ":${port}")
  elif command -v netstat &>/dev/null; then
    result=$(netstat -tlnp 2>/dev/null | grep ":${port} ")
  else
    result=$(lsof -i ":${port}" -sTCP:LISTEN 2>/dev/null | grep LISTEN)
  fi

  if [[ -n "$result" ]]; then
    # Tìm process name
    local pname=""
    if command -v lsof &>/dev/null; then
      pname=$(lsof -i ":${port}" -sTCP:LISTEN -Fc 2>/dev/null | grep "^c" | head -1 | cut -c2-)
    fi
    if [[ -z "$pname" ]] && command -v ss &>/dev/null; then
      pname=$(ss -tlnp "sport = :${port}" 2>/dev/null | grep -oP 'users:\(\("?\K[^"]+' | head -1)
    fi
    used "port ${port} ← ${pname:-unknown process}"
    return 1
  else
    free "$port"
    return 0
  fi
}

# ── Kiểm tra từng port yêu cầu ───────────────────────────────────────────────
log "Kiểm tra ports yêu cầu: ${PORTS_TO_CHECK[*]}"
echo ""
ALL_FREE=true
for p in "${PORTS_TO_CHECK[@]}"; do
  check_port "$p" || ALL_FREE=false
done

# ── Tổng quan toàn bộ ports đang lắng nghe ───────────────────────────────────
echo ""
log "Danh sách TẤT CẢ ports đang được dùng trên server:"
echo ""
if command -v ss &>/dev/null; then
  printf "  %-8s %-22s %-20s %s\n" "PORT" "ADDRESS" "PROCESS" "PID"
  printf "  %-8s %-22s %-20s %s\n" "────" "───────────────────" "──────────────────" "───"
  ss -tlnp 2>/dev/null | grep LISTEN | awk '{
    port=$4; sub(/.*:/, "", port)
    addr=$4; sub(/:[^:]+$/, "", addr)
    proc=$6; gsub(/users:\(\("|",.*/, "", proc)
    printf "  %-8s %-22s %-20s\n", port, addr, proc
  }' | sort -n
elif command -v netstat &>/dev/null; then
  netstat -tlnp 2>/dev/null | grep LISTEN | awk '{printf "  %-8s %-25s %s\n", $4, $1, $7}' | \
    sed 's/.*://1' | sort -n
else
  warn "Cài 'ss' (iproute2) để xem chi tiết: apt install iproute2"
fi

# ── Ports Docker đang dùng ────────────────────────────────────────────────────
echo ""
if command -v docker &>/dev/null; then
  log "Docker containers và ports đang map:"
  echo ""
  DOCKER_OUT=$(docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" 2>/dev/null)
  if [[ -n "$DOCKER_OUT" ]]; then
    echo "$DOCKER_OUT" | awk 'NR==1{printf "  %s\n",$0} NR>1{printf "  %s\n",$0}'
  else
    echo "  (không có container nào đang chạy)"
  fi
else
  warn "Docker chưa cài hoặc không có quyền chạy lệnh docker"
fi

# ── Nginx / Apache ────────────────────────────────────────────────────────────
echo ""
log "Web server processes:"
for svc in nginx apache2 caddy; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    ok "$svc đang chạy"
  elif command -v "$svc" &>/dev/null; then
    warn "$svc được cài nhưng chưa chạy"
  fi
done

# ── Kết quả ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════${NC}"
if $ALL_FREE; then
  echo -e "${GREEN}${BOLD} ✓ Tất cả ports cần thiết đều FREE!${NC}"
  echo -e "   App có thể deploy ngay với port 3001"
else
  echo -e "${YELLOW}${BOLD} ⚠ Một số ports đã bị chiếm.${NC}"
  echo ""
  echo "  Giải pháp:"
  echo "  • Đổi port app: sửa PORT trong server/.env + docker-compose.yml"
  echo "  • Hoặc dừng process đang chiếm: sudo kill \$(sudo lsof -t -i:<PORT>)"
  echo "  • Docker: docker stop <container-name>"
fi
echo -e "${BOLD}════════════════════════════════════════${NC}"
echo ""
