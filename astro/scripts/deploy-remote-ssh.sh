#!/usr/bin/env bash
set -euo pipefail

DEFAULT_SSH_TARGET="root@vigorous-pike"
DEFAULT_REMOTE_ASTRO_DIR="/var/www/vhosts/fenicio.es/app/astro"
DEFAULT_REMOTE_RUN_AS="fenicio.es"

SSH_TARGET="${PLESK_SSH_TARGET:-$DEFAULT_SSH_TARGET}"
REMOTE_ASTRO_DIR="${REMOTE_ASTRO_DIR:-$DEFAULT_REMOTE_ASTRO_DIR}"
REMOTE_RUN_AS="${REMOTE_RUN_AS:-$DEFAULT_REMOTE_RUN_AS}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
USE_NPM_CI="${USE_NPM_CI:-1}"
HEALTHCHECK_CONNECT_IP="${HEALTHCHECK_CONNECT_IP:-127.0.0.1}"

echo "==> Ejecutando despliegue remoto en ${SSH_TARGET}"
echo "==> Proyecto remoto: ${REMOTE_ASTRO_DIR}"
echo "==> Usuario remoto: ${REMOTE_RUN_AS}"

ssh "$SSH_TARGET" "bash -lc '
set -euo pipefail

if ! id -u \"$REMOTE_RUN_AS\" >/dev/null 2>&1; then
  echo \"No existe usuario remoto: $REMOTE_RUN_AS\"
  exit 1
fi

if [[ ! -d \"$REMOTE_ASTRO_DIR\" ]]; then
  echo \"No existe directorio remoto: $REMOTE_ASTRO_DIR\"
  exit 1
fi

su -s /bin/bash \"$REMOTE_RUN_AS\" -c \"cd \\\"$REMOTE_ASTRO_DIR\\\" && DEPLOY_BRANCH=\\\"$DEPLOY_BRANCH\\\" USE_NPM_CI=\\\"$USE_NPM_CI\\\" DEPLOY_LOCAL=1 APPLY_OWNER_PERMS=0 HEALTHCHECK_CONNECT_IP=\\\"$HEALTHCHECK_CONNECT_IP\\\" npm run deploy:full\"

chown -R \"$REMOTE_RUN_AS\":psacln /var/www/vhosts/fenicio.es/httpdocs
find /var/www/vhosts/fenicio.es/httpdocs -type d -exec chmod 755 {} \\\;
find /var/www/vhosts/fenicio.es/httpdocs -type f -exec chmod 644 {} \\\;
echo \"Permisos finales ajustados en httpdocs\"
'"

echo "Despliegue remoto completado."
