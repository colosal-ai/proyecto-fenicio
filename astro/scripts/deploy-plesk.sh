#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/"
DEFAULT_SSH_TARGET="root@vigorous-pike"
DEFAULT_HTTPDOCS_PATH="/var/www/vhosts/fenicio.es/httpdocs"

PLESK_SSH_TARGET="${PLESK_SSH_TARGET:-$DEFAULT_SSH_TARGET}"
PLESK_HTTPDOCS_PATH="${PLESK_HTTPDOCS_PATH:-$DEFAULT_HTTPDOCS_PATH}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "No existe dist/. Ejecuta primero: npm run build"
  exit 1
fi

echo "Desplegando dist/ a ${PLESK_SSH_TARGET}:${PLESK_HTTPDOCS_PATH}"
rsync -avz --delete "$DIST_DIR" "${PLESK_SSH_TARGET}:${PLESK_HTTPDOCS_PATH}/"
echo "Despliegue completado."
