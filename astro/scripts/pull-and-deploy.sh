#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/.." && pwd)"

BRANCH="${DEPLOY_BRANCH:-main}"
USE_NPM_CI="${USE_NPM_CI:-1}"
DEPLOY_LOCAL="${DEPLOY_LOCAL:-0}"
APPLY_OWNER_PERMS="${APPLY_OWNER_PERMS:-1}"
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

# Limpia artefactos generados que suelen mutar en servidor y bloquear git pull.
echo "==> Limpieza previa de artefactos generados"
# public/vendor/ es legado (vendorize deprecado); link:assets usa static.* del repo.

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
if [[ "$DEPLOY_LOCAL" == "1" ]]; then
  echo "Modo local activado: copiando dist/ directamente a $PLESK_HTTPDOCS_PATH"
  rsync -av --delete "$ROOT_DIR/dist/" "$PLESK_HTTPDOCS_PATH/"
  if [[ "$APPLY_OWNER_PERMS" == "1" ]]; then
    if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
      chown -R "${DEPLOY_OWNER}:${DEPLOY_GROUP}" "$PLESK_HTTPDOCS_PATH"
      find "$PLESK_HTTPDOCS_PATH" -type d -exec chmod 755 {} \;
      find "$PLESK_HTTPDOCS_PATH" -type f -exec chmod 644 {} \;
    else
      echo "APPLY_OWNER_PERMS=1 pero no eres root. Saltando chown/chmod."
    fi
  fi
else
  PLESK_SSH_TARGET="$PLESK_SSH_TARGET" \
  PLESK_HTTPDOCS_PATH="$PLESK_HTTPDOCS_PATH" \
  DEPLOY_OWNER="$DEPLOY_OWNER" \
  DEPLOY_GROUP="$DEPLOY_GROUP" \
    "$NPM_BIN" run deploy:plesk
fi

echo "==> [5/5] Verificación rápida remota"
if [[ "$DEPLOY_LOCAL" == "1" ]]; then
  test -f "$PLESK_HTTPDOCS_PATH/index.html" && echo "index.html OK en destino"
  HEALTHCHECK_CONNECT_IP="${HEALTHCHECK_CONNECT_IP:-127.0.0.1}" "$NPM_BIN" run healthcheck:local
else
  ssh "$PLESK_SSH_TARGET" "test -f \"$PLESK_HTTPDOCS_PATH/index.html\" && echo 'index.html OK en destino'"
  ssh "$PLESK_SSH_TARGET" "cd \"$ROOT_DIR\" && HEALTHCHECK_CONNECT_IP=\"${HEALTHCHECK_CONNECT_IP:-127.0.0.1}\" \"$NPM_BIN\" run healthcheck:local"
fi

echo "Despliegue completado correctamente."
