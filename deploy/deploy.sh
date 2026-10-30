#!/usr/bin/env bash
# One-command deploy for NDPA Lens on the VPS.
#
#   bash deploy/deploy.sh
#
# What it does, in order:
#   1. Asks for the OpenRouter key once and saves it in deploy/.env
#   2. Finds the Caddy that already owns ports 80/443 (azaman-engine's)
#   3. Makes sure that Caddy serves lens.taxcafe.pro (adds the site if missing,
#      checks the config, and only then reloads; your other site keeps working)
#   4. Builds and starts NDPA Lens on Caddy's network
#   5. Checks DNS and that the site answers
#
# Safe to run again any time (e.g. after git pull).

set -euo pipefail

LENS_DOMAIN="${LENS_DOMAIN:-lens.taxcafe.pro}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO/deploy/.env"
COMPOSE=(docker compose -f "$REPO/deploy/docker-compose.yml")

say()  { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*"; }
die()  { printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "Docker is not installed."
docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is missing."

# ---------------------------------------------------------------- 1. settings
say "Settings (deploy/.env)"
[ -f "$ENV_FILE" ] || cp "$REPO/deploy/.env.example" "$ENV_FILE"
chmod 600 "$ENV_FILE"

current_key="$(grep -E '^OPENROUTER_API_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
if [ -z "$current_key" ] && [ -f "$REPO/.env" ]; then
  # Key from the earlier setup, if there was one.
  current_key="$(grep -E '^OPENROUTER_API_KEY=' "$REPO/.env" | head -1 | cut -d= -f2- || true)"
fi
if [ -z "$current_key" ]; then
  read -r -s -p "Paste your OpenRouter API key (input hidden, Enter to skip AI): " current_key
  echo
fi
if [ -n "$current_key" ]; then
  grep -v -E '^OPENROUTER_API_KEY=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
  printf 'OPENROUTER_API_KEY=%s\n' "$current_key" >> "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE" && chmod 600 "$ENV_FILE"
  echo "Key saved."
else
  warn "No key: scans work, but without the AI review."
fi
# Leftovers from the first attempt.
rm -f "$REPO/docker-compose.override.yml"

# ------------------------------------------------------------ 2. find Caddy
say "Finding the Caddy that serves ports 80/443"
CADDY="$(docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' \
  | awk '$2 ~ /caddy/ && /:443->/ {print $1; exit}')"
[ -n "$CADDY" ] || die "No running Caddy container on port 443. Start azaman-engine first."

NET="$(docker inspect "$CADDY" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')"
CADDYFILE="$(docker inspect "$CADDY" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')"
[ -n "$NET" ] || die "Couldn't find $CADDY's network."
[ -f "$CADDYFILE" ] || die "Couldn't find $CADDY's Caddyfile on this server."
echo "Caddy: $CADDY   network: $NET"
echo "Caddyfile: $CADDYFILE"

# ------------------------------------------------- 3. add the site to Caddy
say "Making sure Caddy serves $LENS_DOMAIN"
has_site() { grep -qE "LENS_DOMAIN|$LENS_DOMAIN" "$1"; }
changed=no
if ! has_site "$CADDYFILE"; then
  AZ_REPO="$(git -C "$(dirname "$CADDYFILE")" rev-parse --show-toplevel 2>/dev/null || true)"
  # Prefer getting the site block from azaman-engine's main branch.
  if [ -n "$AZ_REPO" ] && [ "$(git -C "$AZ_REPO" branch --show-current)" = "main" ] \
     && [ -z "$(git -C "$AZ_REPO" status --porcelain --untracked-files=no)" ]; then
    git -C "$AZ_REPO" pull -q --ff-only && echo "Updated azaman-engine from GitHub." || true
  fi
  if ! has_site "$CADDYFILE"; then
    cp "$CADDYFILE" "$CADDYFILE.bak.$(date +%s)"
    cat >> "$CADDYFILE" <<EOF

# NDPA Lens (added by ndpa-lens/deploy/deploy.sh)
$LENS_DOMAIN {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}
	reverse_proxy ndpa-lens:3000 {
		transport http {
			read_timeout 180s
			write_timeout 180s
		}
	}
}
EOF
    echo "Added the site block (backup saved next to the Caddyfile)."
  fi
  changed=yes
else
  echo "Already there."
fi

if [ "$changed" = yes ]; then
  # Check the new config with the same environment the running Caddy has.
  docker inspect "$CADDY" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -E '^(DOMAIN|LENS_DOMAIN)=' > /tmp/ndpa-caddy.env || true
  if ! docker run --rm --env-file /tmp/ndpa-caddy.env \
       -v "$CADDYFILE:/etc/caddy/Caddyfile:ro" caddy:2 \
       caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/tmp/ndpa-caddy.log 2>&1; then
    rm -f /tmp/ndpa-caddy.env
    cat /tmp/ndpa-caddy.log
    die "The new Caddy config is invalid, so Caddy was NOT reloaded. Your other site is untouched. Send this output to fix it."
  fi
  rm -f /tmp/ndpa-caddy.env
  # A git pull replaces the file, which the running container can't see; a restart picks it up.
  if docker exec "$CADDY" grep -qE "LENS_DOMAIN|$LENS_DOMAIN" /etc/caddy/Caddyfile; then
    docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  else
    docker restart "$CADDY" >/dev/null
  fi
  echo "Caddy reloaded."
fi

# ---------------------------------------------------- 4. build and start app
say "Building and starting NDPA Lens (first build takes a few minutes)"
PROXY_NETWORK="$NET" "${COMPOSE[@]}" up -d --build --remove-orphans
rm -f "$REPO/.env"   # old location; settings now live in deploy/.env

for _ in $(seq 1 30); do
  state="$(docker inspect ndpa-lens-ndpa-lens-1 --format '{{.State.Health.Status}}' 2>/dev/null || echo starting)"
  [ "$state" = healthy ] && break
  sleep 2
done
echo "App status: ${state:-unknown}"

# --------------------------------------------------------- 5. DNS and check
say "Checking $LENS_DOMAIN"
SERVER_IP="$(curl -fsS -4 --max-time 5 https://ifconfig.me 2>/dev/null || true)"
DNS_IP="$(getent ahostsv4 "$LENS_DOMAIN" 2>/dev/null | awk 'NR==1{print $1}')"
if [ -z "$DNS_IP" ]; then
  warn "$LENS_DOMAIN has no DNS record yet. Add an A record: name 'lens', value ${SERVER_IP:-this server IP}. Then run this script again."
  exit 0
elif [ -n "$SERVER_IP" ] && [ "$DNS_IP" != "$SERVER_IP" ]; then
  warn "$LENS_DOMAIN points to $DNS_IP, but this server is $SERVER_IP. Fix the A record, then run this script again."
  exit 0
fi

code="000"
for _ in $(seq 1 15); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$LENS_DOMAIN/" || true)"
  [ "$code" = 200 ] && break
  sleep 4
done
if [ "$code" = 200 ]; then
  say "Done. Open https://$LENS_DOMAIN"
else
  warn "https://$LENS_DOMAIN answered $code. The certificate may still be coming; wait a minute and open it."
  echo "If it still fails, send these logs:"
  echo "  docker logs --tail 30 $CADDY"
  echo "  docker logs --tail 30 ndpa-lens-ndpa-lens-1"
fi
