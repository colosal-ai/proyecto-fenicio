#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/.." && pwd)"

BRANCH="${DEPLOY_BRANCH:-main}"
USE_NPM_CI="${USE_NPM_CI:-1}"
DEFAULT_SSH_TARGET="root@vigorous-pike"
DEFAULT_HTTPDOCS_PATH="/var/www/vhosts/fenicio.es/httpdocs"

PLESK_SSH_TARGET="${PLESK_SSH_TARGET:-$DEFAULT_SSH_TARGET}"
PLESK_HTTPDOCS_PATH="${PLESK_HTTPDOCS_PATH:-$DEFAULT_HTTPDOCS_PATH}"

echo "==> [1/5] Sincronizando repositorio (rama: ${BRANCH})"
cd "$REPO_DIR"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> [2/5] Instalando dependencias"
cd "$ROOT_DIR"
if [[ "$USE_NPM_CI" == "1" ]]; then
  npm ci
else
  npm install
fi

echo "==> [3/5] Generando build (prepare)"
npm run prepare

echo "==> [4/5] Publicando en Plesk"
npm run deploy:plesk

echo "==> [5/5] Verificación rápida remota"
ssh "$PLESK_SSH_TARGET" "test -f \"$PLESK_HTTPDOCS_PATH/index.html\" && echo 'index.html OK en destino'"

echo "Despliegue completado correctamente."
