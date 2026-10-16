#!/usr/bin/env bash
# Urban Luxe CRM — установка на сервер hk-urbanluxe (рядом с HK-ботом). 16.10.2026.
#   curl -fsSL urbanluxe.cc/crm/d047c65a8262/i.sh | sudo bash
# Делает: подкачка, код CRM в /opt/crm, .env с секретами (генерируются здесь; ключ PMS и секрет вебхука —
# по одноразовой ссылке из PMS), сборка образов по одному (4 ГБ RAM), миграции, первый админ,
# сайт crm.urbanluxe.cc в Caddy HK-бота, ufw. В конце печатает пароль администратора — один раз.
set -euo pipefail
BASE="https://urbanluxe.cc/crm/d047c65a8262"
ONCE="02bcbc141f2e798e47a2368a1b6d4cb998a0"
DOMAIN="crm.urbanluxe.cc"
DIR="/opt/crm"
HK_DIR="/opt/housekeeping_bot"
ADMIN_EMAIL="arsenalkingt10@gmail.com"
COMPOSE="docker compose --env-file $DIR/.env -f $DIR/deploy/docker-compose.hk.yml"
c() { printf '\n\033[1;36m%s\033[0m\n' "$*"; }
ok() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }
[ "$(id -u)" = 0 ] || die "Запустите через sudo"
LOG=/var/log/crm-install.log; exec > >(tee -a "$LOG") 2>&1
command -v docker >/dev/null || die "Нет Docker — это не сервер HK-бота?"

# ---------- 1. Подкачка: сборка Next.js + Nest на 4 ГБ без неё падает ----------
c "1/7 Подкачка"
if [ "$(free -m | awk '/Swap/{print $2}')" -lt 3000 ]; then
  swapoff /swapfile 2>/dev/null || true; rm -f /swapfile
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
ok "swap $(free -m | awk '/Swap/{print $2}') МБ"

# ---------- 2. Код ----------
c "2/7 Код CRM → $DIR"
mkdir -p "$DIR" /tmp/crm && curl -fsSL "$BASE/crm.tar.gz" -o /tmp/crm/crm.tgz && curl -fsSL "$BASE/crm.sha256" -o /tmp/crm/crm.sha256
echo "$(cat /tmp/crm/crm.sha256)  /tmp/crm/crm.tgz" | sha256sum -c - >/dev/null || die "Архив повреждён"
tar -xzf /tmp/crm/crm.tgz -C "$DIR"
ok "распаковано: $(find "$DIR" -type f | wc -l) файлов"

# ---------- 3. .env ----------
c "3/7 Настройки"
if [ -f "$DIR/.env" ]; then ok ".env уже есть — оставляю (повторная установка)"; else
  PG=$(openssl rand -hex 24); JWT=$(openssl rand -base64 48 | tr -d '\n'); CSK=$(openssl rand -base64 32 | tr -d '\n')
  RCS=$(openssl rand -hex 24); GAT=$(openssl rand -hex 24); ADMIN_PASS=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)
  SETUP=$(curl -fsS "https://urbanluxe.cc/.netlify/functions/pms-api?a=crm_setup&once=$ONCE" || echo '{}')
  PMS_KEY=$(echo "$SETUP" | sed -n 's/.*"PMS_API_KEY":"\([^"]*\)".*/\1/p'); PMS_WH=$(echo "$SETUP" | sed -n 's/.*"PMS_WEBHOOK_SECRET":"\([^"]*\)".*/\1/p')
  [ -n "$PMS_KEY" ] && ok "ключ PMS получен" || echo "! Ключ PMS не получен (одноразовая ссылка уже использована?) — мост с PMS выключен, задайте PMS_API_KEY в $DIR/.env позже"
  cat > "$DIR/.env" <<EOF
# Urban Luxe CRM — создано установщиком $(date -u +%F)
NODE_ENV=production
DOMAIN=$DOMAIN
WEB_ORIGIN=https://$DOMAIN
PUBLIC_API_URL=https://$DOMAIN
POSTGRES_PASSWORD=$PG
DATABASE_URL=postgresql://crm:$PG@postgres:5432/crm
JWT_SECRET=$JWT
SESSION_TTL_HOURS=168
SEED_ADMIN_EMAIL=$ADMIN_EMAIL
SEED_ADMIN_NAME=Арсен
SEED_ADMIN_PASSWORD=$ADMIN_PASS
CHANNEL_SECRET_KEY=$CSK
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
GREEN_API_ID_INSTANCE=
GREEN_API_TOKEN=
GREEN_API_MEDIA_URL=
GREEN_API_WEBHOOK_TOKEN=$GAT
RC_WEBHOOK_SECRET=$RCS
RC_CURRENCY=USD
PMS_API_URL=https://urbanluxe.cc/api/v1
PMS_API_KEY=$PMS_KEY
PMS_WEBHOOK_SECRET=$PMS_WH
PMS_WEB_URL=https://urbanluxe.cc/pms
EOF
  chmod 600 "$DIR/.env"; ok ".env создан"
fi

# ---------- 4. Сборка (по одному образу — памяти мало) ----------
c "4/7 Сборка образов (10–20 минут на CX23)"
export COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=1
$COMPOSE build migrate 2>&1 | tail -3
$COMPOSE build web 2>&1 | tail -3
ok "образы собраны"

# ---------- 5. Запуск + миграции + админ ----------
c "5/7 Запуск"
# миграции отдельно и с логом (при ошибке видно причину), затем сервисы
$COMPOSE run --rm migrate pnpm db:deploy 2>&1 | tail -15 || die "Миграции не прошли — пришлите вывод выше"
$COMPOSE up -d --no-deps postgres api web
for i in $(seq 1 40); do
  if curl -fsS http://172.17.0.1:4000/api/health 2>/dev/null | grep -q '"ok"\|status'; then ok "API отвечает"; break; fi
  sleep 5; [ "$i" = 40 ] && { $COMPOSE logs --tail=60 api; die "API не поднялось — пришлите вывод выше"; }
done
$COMPOSE run --rm migrate pnpm db:seed >/dev/null 2>&1 && ok "Администратор создан ($ADMIN_EMAIL)" || echo "· администратор уже существует или seed не отработал (см. $LOG)"

# ---------- 6. Caddy HK-бота: сайт crm.urbanluxe.cc ----------
c "6/7 HTTPS через Caddy HK-бота"
CF="$HK_DIR/deploy/Caddyfile"
[ -f "$CF" ] || die "Не найден $CF — Caddy HK-бота не там, где ожидалось"
if ! grep -q "$DOMAIN" "$CF"; then
cat >> "$CF" <<EOF

# Urban Luxe CRM (16.10.2026): API и веб в контейнерах crm_*, слушают на docker0
$DOMAIN {
    encode zstd gzip
    @api path /api/*
    reverse_proxy @api host.docker.internal:4000 {
        lb_try_duration 60s
        lb_try_interval 1s
    }
    reverse_proxy host.docker.internal:3000 {
        lb_try_duration 60s
        lb_try_interval 1s
    }
}
EOF
fi
command -v ufw >/dev/null && { ufw allow from 172.16.0.0/12 to any port 3000 proto tcp >/dev/null 2>&1 || true; ufw allow from 172.16.0.0/12 to any port 4000 proto tcp >/dev/null 2>&1 || true; }
docker restart housekeeping_caddy >/dev/null && ok "Caddy перезапущен"

# ---------- 7. Команда crm + бэкап ----------
c "7/7 Служебное"
cat > /usr/local/bin/crm <<EOF
#!/usr/bin/env bash
C="$COMPOSE"
case "\$1" in
  logs) \$C logs -f --tail=100 \${2:-api};;
  restart) \$C restart api web;;
  env) \${EDITOR:-nano} $DIR/.env && \$C up -d;;
  backup) mkdir -p /var/backups/crm && \$C exec -T postgres pg_dump -U crm crm | gzip > /var/backups/crm/crm-\$(date +%F-%H%M).sql.gz && ls -t /var/backups/crm | head -3;;
  seed) \$C run --rm migrate pnpm db:seed;;
  *) \$C ps; curl -fsS https://$DOMAIN/api/health; echo;;
esac
EOF
chmod +x /usr/local/bin/crm
( crontab -l 2>/dev/null | grep -v 'crm backup'; echo '15 3 * * * /usr/local/bin/crm backup >/dev/null 2>&1' ) | crontab - 2>/dev/null || true
ok "команда crm (logs/restart/env/backup/seed), бэкап базы в 03:15"

c "ГОТОВО. Вход: https://$DOMAIN"
echo "  логин:  $ADMIN_EMAIL"
grep -q '^SEED_ADMIN_PASSWORD=' "$DIR/.env" && echo "  пароль: $(grep '^SEED_ADMIN_PASSWORD=' "$DIR/.env" | cut -d= -f2-)  (смените после входа)"
echo "  проверка: curl https://$DOMAIN/api/health   логи: crm logs"
