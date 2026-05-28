#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/"
DEFAULT_SSH_TARGET="root@vigorous-pike"
DEFAULT_HTTPDOCS_PATH="/var/www/vhosts/fenicio.es/httpdocs"
DEFAULT_DEPLOY_OWNER="fenicio.es"
DEFAULT_DEPLOY_GROUP="psacln"

PLESK_SSH_TARGET="${PLESK_SSH_TARGET:-$DEFAULT_SSH_TARGET}"
PLESK_HTTPDOCS_PATH="${PLESK_HTTPDOCS_PATH:-$DEFAULT_HTTPDOCS_PATH}"
DEPLOY_OWNER="${DEPLOY_OWNER:-$DEFAULT_DEPLOY_OWNER}"
DEPLOY_GROUP="${DEPLOY_GROUP:-$DEFAULT_DEPLOY_GROUP}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "No existe dist/. Ejecuta primero: npm run build"
  exit 1
fi

echo "Desplegando dist/ a ${PLESK_SSH_TARGET}:${PLESK_HTTPDOCS_PATH}"
rsync -avz --delete "$DIST_DIR" "${PLESK_SSH_TARGET}:${PLESK_HTTPDOCS_PATH}/"

echo "Ajustando owner/permisos en destino (${DEPLOY_OWNER}:${DEPLOY_GROUP})"
ssh "$PLESK_SSH_TARGET" "chown -R ${DEPLOY_OWNER}:${DEPLOY_GROUP} \"$PLESK_HTTPDOCS_PATH\" && find \"$PLESK_HTTPDOCS_PATH\" -type d -exec chmod 755 {} \\; && find \"$PLESK_HTTPDOCS_PATH\" -type f -exec chmod 644 {} \\;"

echo "Despliegue completado."
