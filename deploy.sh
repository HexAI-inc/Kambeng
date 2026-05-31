#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend-next"
BACKEND_COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"
BACKEND_ENV_FILE="$BACKEND_DIR/.env"
BACKEND_ENV_EXAMPLE="$BACKEND_DIR/.env.example"
FRONTEND_ENV_FILE="$FRONTEND_DIR/.env.local"
FRONTEND_ENV_EXAMPLE="$FRONTEND_DIR/.env.local.example"
FRONTEND_LOG_FILE="$FRONTEND_DIR/deploy.log"
FRONTEND_SERVICE_NAME="kambeng-frontend"
FRONTEND_SERVICE_FILE="/etc/systemd/system/${FRONTEND_SERVICE_NAME}.service"

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

ensure_env_file() {
  local target_file="$1"
  local example_file="$2"

  if [[ -f "$target_file" ]]; then
    return 0
  fi

  [[ -f "$example_file" ]] || die "Missing env file and example template: $target_file"
  cp "$example_file" "$target_file"
  printf 'Created %s from %s. Edit it with production values, then rerun this script.\n' "$target_file" "$example_file"
  exit 1
}

write_frontend_service() {
  local service_text

  service_text=$(cat <<EOF
[Unit]
Description=Kambeng Next.js frontend
After=network.target

[Service]
Type=simple
WorkingDirectory=$FRONTEND_DIR
Environment=HOST=0.0.0.0
Environment=PORT=3000
ExecStart=/usr/bin/npm run start -- --hostname 0.0.0.0 --port 3000
Restart=always
RestartSec=5
StandardOutput=append:$FRONTEND_LOG_FILE
StandardError=append:$FRONTEND_LOG_FILE

[Install]
WantedBy=multi-user.target
EOF
)

  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    printf '%s\n' "$service_text" > "$FRONTEND_SERVICE_FILE"
  elif command -v sudo >/dev/null 2>&1; then
    printf '%s\n' "$service_text" | sudo tee "$FRONTEND_SERVICE_FILE" >/dev/null
  else
    die "systemd service creation requires root or sudo"
  fi
}

start_frontend() {
  if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
    log "Installing systemd service for the frontend"
    write_frontend_service

    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
      systemctl daemon-reload
      systemctl enable --now "$FRONTEND_SERVICE_NAME"
      systemctl restart "$FRONTEND_SERVICE_NAME"
    elif command -v sudo >/dev/null 2>&1; then
      sudo systemctl daemon-reload
      sudo systemctl enable --now "$FRONTEND_SERVICE_NAME"
      sudo systemctl restart "$FRONTEND_SERVICE_NAME"
    else
      die "systemctl is available but sudo is not"
    fi

    log "Frontend is managed by systemd"
    printf 'Service file: %s\n' "$FRONTEND_SERVICE_FILE"
    return 0
  fi

  log "systemd is unavailable; starting frontend with nohup"
  (
    cd "$FRONTEND_DIR"
    nohup npm run start -- --hostname 0.0.0.0 --port 3000 > "$FRONTEND_LOG_FILE" 2>&1 &
    echo $! > "$FRONTEND_DIR/.deploy.pid"
  )
}

require_command docker
require_command npm

[[ -f "$BACKEND_COMPOSE_FILE" ]] || die "Missing backend compose file: $BACKEND_COMPOSE_FILE"
[[ -f "$FRONTEND_DIR/package-lock.json" ]] || die "Missing frontend lockfile: $FRONTEND_DIR/package-lock.json"

ensure_env_file "$BACKEND_ENV_FILE" "$BACKEND_ENV_EXAMPLE"
ensure_env_file "$FRONTEND_ENV_FILE" "$FRONTEND_ENV_EXAMPLE"

log "Installing frontend dependencies"
npm ci --prefix "$FRONTEND_DIR"

log "Building frontend"
npm run build --prefix "$FRONTEND_DIR"

log "Starting backend stack"
docker compose -f "$BACKEND_COMPOSE_FILE" up -d --build

log "Running backend migrations"
docker compose -f "$BACKEND_COMPOSE_FILE" exec -T api alembic upgrade head

start_frontend

log "Deployment complete"
printf 'Frontend log: %s\n' "$FRONTEND_LOG_FILE"
printf 'Nginx config: %s\n' "$ROOT_DIR/deploy/nginx/kambeng.conf"