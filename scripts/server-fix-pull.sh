#!/usr/bin/env bash
# En el SERVIDOR cuando git pull falla por astro/public/raw modificados.
set -euo pipefail

REPO_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$REPO_DIR"

echo "==> Limpiando artefactos generados en disco"
bash "$REPO_DIR/astro/scripts/clean-generated-public.sh"

echo "==> Sincronizando con origin/${BRANCH} (descarta cambios locales en archivos trackeados)"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

echo "==> OK. Ahora: cd astro && npm run deploy:server"
echo "    (o solo: npm run prepare dentro de astro si ya hiciste pull)"
