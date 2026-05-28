#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "No existe dist/. Ejecuta primero: npm run build"
  exit 1
fi

if [[ -z "${PLESK_SSH_TARGET:-}" || -z "${PLESK_HTTPDOCS_PATH:-}" ]]; then
  echo "Faltan variables de entorno:"
  echo "  PLESK_SSH_TARGET=usuario@host"
  echo "  PLESK_HTTPDOCS_PATH=/var/www/vhosts/tu-dominio/httpdocs"
  exit 1
fi

echo "Desplegando dist/ a ${PLESK_SSH_TARGET}:${PLESK_HTTPDOCS_PATH}"
rsync -avz --delete "$DIST_DIR" "${PLESK_SSH_TARGET}:${PLESK_HTTPDOCS_PATH}/"
echo "Despliegue completado."
