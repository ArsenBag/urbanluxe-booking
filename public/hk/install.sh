#!/usr/bin/env bash
# Urban Luxe — установка housekeeping-бота на VPS одной командой (09.10.2026).
#   curl -fsSL https://urbanluxe.cc/hk/install.sh -o install.sh && sudo bash install.sh
# Что делает: ставит Docker, скачивает код бота с urbanluxe.cc, спрашивает токен бота и ваш Telegram ID,
# сам генерирует секреты, поднимает бота + Caddy (HTTPS на hk.urbanluxe.cc), импортирует квартиры,
# включает ежедневный бэкап и печатает три значения для Netlify. Повторный запуск — безопасен (обновление).
set -euo pipefail

PKG_URL="https://urbanluxe.cc/hk/housekeeping_bot.tar.gz"
DOMAIN="${HK_DOMAIN:-hk.urbanluxe.cc}"
DIR="/opt/housekeeping_bot"
COMPOSE="docker compose --env-file $DIR/.env -f $DIR/deploy/docker-compose.prod.yml"

c() { printf '\033[1;33m%s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Запустите через sudo: sudo bash install.sh"
command -v curl >/dev/null || { apt-get update -qq && apt-get install -y -qq curl ca-certificates; }

# ---------- 1. Docker ----------
if ! command -v docker >/dev/null; then
  c "Ставлю Docker…"; curl -fsSL https://get.docker.com | sh >/dev/null
fi
docker compose version >/dev/null 2>&1 || die "Docker Compose не установился — напишите мне вывод этой команды: docker compose version"
systemctl enable --now docker >/dev/null 2>&1 || true
ok "Docker $(docker --version | sed 's/Docker version //;s/,.*//')"

# ---------- 2. Код бота ----------
c "Скачиваю бота…"
mkdir -p "$DIR" /tmp/hk && curl -fsSL "$PKG_URL" -o /tmp/hk/pkg.tgz
if [ -f "$DIR/.env" ]; then cp "$DIR/.env" /tmp/hk/env.bak; fi
tar -xzf /tmp/hk/pkg.tgz -C "$DIR" --strip-components=1
[ -f /tmp/hk/env.bak ] && cp /tmp/hk/env.bak "$DIR/.env"
mkdir -p "$DIR/data" "$DIR/backups"
ok "Код в $DIR"

# ---------- 3. DNS ----------
MYIP=$(curl -fsS -4 https://api.ipify.org || curl -fsS -4 https://ifconfig.me || echo "?")
DNSIP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)
if [ "$DNSIP" = "$MYIP" ]; then ok "DNS: $DOMAIN → $MYIP"
else
  c "DNS: $DOMAIN сейчас → '${DNSIP:-нет записи}', а IP сервера — $MYIP."
  c "Добавьте в DNS urbanluxe.cc запись  A  hk  →  $MYIP  (это можно сделать и после установки — HTTPS подключится сам)."
fi

# ---------- 4. Секреты ----------
ENV="$DIR/.env"
getv() { grep -E "^$1=" "$ENV" 2>/dev/null | head -1 | cut -d= -f2- || true; }
if [ ! -f "$ENV" ]; then cp "$DIR/deploy/env.production.example" "$ENV"; fi
chmod 600 "$ENV"
setv() { if grep -qE "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else printf '%s=%s\n' "$1" "$2" >>"$ENV"; fi; }

BOT_TOKEN=$(getv BOT_TOKEN)
while :; do
  if [ -n "$BOT_TOKEN" ] && [ "$BOT_TOKEN" != "telegram-bot-token" ]; then
    ME=$(curl -fsS "https://api.telegram.org/bot$BOT_TOKEN/getMe" 2>/dev/null || true)
    if echo "$ME" | grep -q '"ok":true'; then ok "Бот: @$(echo "$ME" | sed 's/.*"username":"\([^"]*\)".*/\1/')"; break; fi
    c "Токен не подошёл (Telegram не принял)."
  fi
  read -r -s -p "Вставьте токен бота @urbanluxe_cleaning_bot (из @BotFather, ввод скрыт): " BOT_TOKEN; echo
done
setv BOT_TOKEN "$BOT_TOKEN"

# старый вебхук (Netlify tg-staff) снимаем, иначе polling не заработает
curl -fsS "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook?drop_pending_updates=true" >/dev/null && ok "Старый вебхук снят"

ADMIN_IDS=$(getv ADMIN_TELEGRAM_IDS)
if [ -z "$ADMIN_IDS" ] || [ "$ADMIN_IDS" = "123456789" ]; then
  c "Теперь откройте Telegram, напишите боту @urbanluxe_cleaning_bot любое сообщение (например «привет») и нажмите Enter здесь."
  read -r -p "Нажмите Enter после отправки сообщения… " _
  FOUND=$(curl -fsS "https://api.telegram.org/bot$BOT_TOKEN/getUpdates" | grep -o '"from":{"id":[0-9]*' | tail -1 | grep -o '[0-9]*$' || true)
  if [ -n "$FOUND" ]; then
    read -r -p "Ваш Telegram ID: $FOUND — верно? [Enter = да / введите другой]: " X; ADMIN_IDS="${X:-$FOUND}"
  else
    read -r -p "Сообщение не найдено. Введите ваш Telegram ID вручную (число, можно узнать у @userinfobot): " ADMIN_IDS
  fi
fi
[ -n "$ADMIN_IDS" ] || die "Нужен Telegram ID администратора"
setv ADMIN_TELEGRAM_IDS "$ADMIN_IDS"

gen() { openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
for K in REALTYCALENDAR_WEBHOOK_TOKEN DASHBOARD_TOKEN URBANLUXE_EVENTS_TOKEN; do
  V=$(getv "$K"); case "$V" in ""|replace-with*) setv "$K" "$(gen)";; esac
done
setv WEBHOOK_DOMAIN "$DOMAIN"
setv REALTYCALENDAR_WEBHOOK_ENABLED true
setv DASHBOARD_ENABLED true
setv TIMEZONE Asia/Tashkent
setv URBANLUXE_EVENTS_URL "https://urbanluxe.cc/.netlify/functions/hk-events"
ok "Секреты в $ENV"

# ---------- 5. Firewall ----------
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q inactive; then
  ufw allow OpenSSH >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw --force enable >/dev/null && ok "Firewall: 22/80/443"
fi

# ---------- 6. Запуск ----------
c "Собираю и запускаю (1–3 минуты)…"
$COMPOSE up -d --build --remove-orphans >/dev/null 2>&1 || $COMPOSE up -d --build --remove-orphans
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/health 2>/dev/null | grep -q '"ok"'; then ok "Бот запущен (health ok)"; break; fi
  sleep 3; [ "$i" = 30 ] && { $COMPOSE logs --tail=40 housekeeping_bot; die "Бот не поднялся — пришлите мне вывод выше"; }
done

# ---------- 7. Квартиры ----------
$COMPOSE exec -T housekeeping_bot python scripts/import_apartments_csv.py apartments_urbanluxe.csv | tail -2 && ok "Квартиры импортированы"

# ---------- 8. Бэкап + утилита hk ----------
cat >/usr/local/bin/hk <<EOF
#!/usr/bin/env bash
# hk logs | hk restart | hk update | hk backup | hk env | hk status
C="$COMPOSE"
case "\${1:-status}" in
  logs) \$C logs -f --tail=100 housekeeping_bot;;
  restart) \$C restart housekeeping_bot;;
  update) curl -fsSL https://urbanluxe.cc/hk/install.sh -o /tmp/hk-install.sh && bash /tmp/hk-install.sh;;
  backup) mkdir -p $DIR/backups && cp $DIR/data/housekeeping.sqlite3 "$DIR/backups/housekeeping-\$(date +%F-%H%M).sqlite3" && find $DIR/backups -name '*.sqlite3' -mtime +30 -delete && echo "ok";;
  env) cat $DIR/NETLIFY-ENV.txt;;
  *) \$C ps; curl -fsS https://$DOMAIN/health; echo;;
esac
EOF
chmod +x /usr/local/bin/hk
( crontab -l 2>/dev/null | grep -v 'hk backup'; echo "30 23 * * * /usr/local/bin/hk backup >/dev/null 2>&1" ) | crontab -
ok "Бэкап базы каждый день в 23:30, команда: hk (logs/restart/update/backup/env)"

# ---------- 9. Итог ----------
cat >"$DIR/NETLIFY-ENV.txt" <<EOF
Netlify → Site configuration → Environment variables (добавить/обновить, затем Deploy):
HK_WEBHOOK_URL   = https://$DOMAIN/webhooks/realtycalendar
HK_WEBHOOK_TOKEN = $(getv REALTYCALENDAR_WEBHOOK_TOKEN)
HK_EVENTS_TOKEN  = $(getv URBANLUXE_EVENTS_TOKEN)

Панель смены: https://$DOMAIN/dashboard?token=$(getv DASHBOARD_TOKEN)
EOF
chmod 600 "$DIR/NETLIFY-ENV.txt"
echo; c "================= ГОТОВО ================="
cat "$DIR/NETLIFY-ENV.txt"
echo
c "Дальше: 1) внесите три переменные в Netlify и задеплойте;  2) напишите мне «сервер готов» — я загружу брони в бота и проверю связь."
c "Проверка HTTPS (после DNS): curl https://$DOMAIN/health    Логи: hk logs"
