#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/.." && pwd)"

BRANCH="${DEPLOY_BRANCH:-main}"
USE_NPM_CI="${USE_NPM_CI:-1}"
DEFAULT_SSH_TARGET="root@vigorous-pike"
DEFAULT_HTTPDOCS_PATH="/var/www/vhosts/fenicio.es/httpdocs"
DEFAULT_DEPLOY_OWNER="fenicio.es"
DEFAULT_DEPLOY_GROUP="psacln"

PLESK_SSH_TARGET="${PLESK_SSH_TARGET:-$DEFAULT_SSH_TARGET}"
PLESK_HTTPDOCS_PATH="${PLESK_HTTPDOCS_PATH:-$DEFAULT_HTTPDOCS_PATH}"
DEPLOY_OWNER="${DEPLOY_OWNER:-$DEFAULT_DEPLOY_OWNER}"
DEPLOY_GROUP="${DEPLOY_GROUP:-$DEFAULT_DEPLOY_GROUP}"

detect_npm() {
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return 0
  fi

  local candidates=(
    "/opt/plesk/node/24/bin/npm"
    "/opt/plesk/node/22/bin/npm"
  )

  local npm_path
  for npm_path in "${candidates[@]}"; do
    if [[ -x "$npm_path" ]]; then
      echo "$npm_path"
      return 0
    fi
  done

  return 1
}

echo "==> [1/5] Sincronizando repositorio (rama: ${BRANCH})"
cd "$REPO_DIR"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> [2/5] Instalando dependencias"
cd "$ROOT_DIR"
NPM_BIN="$(detect_npm || true)"
if [[ -z "$NPM_BIN" ]]; then
  echo "No se encontró npm en PATH ni en /opt/plesk/node/{24,22}/bin/npm"
  exit 1
fi

NODE_BIN_DIR="$(cd "$(dirname "$NPM_BIN")" && pwd)"
export PATH="$NODE_BIN_DIR:$PATH"
echo "Usando npm: $NPM_BIN"
"$NPM_BIN" -v

if [[ "$USE_NPM_CI" == "1" ]]; then
  "$NPM_BIN" ci
else
  "$NPM_BIN" install
fi

echo "==> [3/5] Generando build (prepare)"
"$NPM_BIN" run prepare

echo "==> [4/5] Publicando en Plesk"
PLESK_SSH_TARGET="$PLESK_SSH_TARGET" \
PLESK_HTTPDOCS_PATH="$PLESK_HTTPDOCS_PATH" \
DEPLOY_OWNER="$DEPLOY_OWNER" \
DEPLOY_GROUP="$DEPLOY_GROUP" \
  "$NPM_BIN" run deploy:plesk

echo "==> [5/5] Verificación rápida remota"
ssh "$PLESK_SSH_TARGET" "test -f \"$PLESK_HTTPDOCS_PATH/index.html\" && echo 'index.html OK en destino'"

echo "Despliegue completado correctamente."
