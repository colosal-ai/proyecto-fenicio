#!/usr/bin/env bash
# Borra salidas de prepare en disco para que git pull no falle (servidor/CI).
set -euo pipefail

ASTRO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ASTRO_DIR/.." && pwd)"

rm -rf \
  "$ASTRO_DIR/.generated" \
  "$ASTRO_DIR/public/raw" \
  "$ASTRO_DIR/public/static.parastorage.com" \
  "$ASTRO_DIR/public/static.wixstatic.com" \
  "$ASTRO_DIR/public/originals" \
  "$ASTRO_DIR/public/vendor" \
  "$ASTRO_DIR/public/backup" \
  "$ASTRO_DIR/dist" \
  "$ASTRO_DIR/.astro"

cd "$REPO_DIR"
# Por si quedaron rutas antiguas aún trackeadas en el clone del servidor
git checkout -- astro/public/raw 2>/dev/null || true
git clean -fd astro/public/raw astro/.generated 2>/dev/null || true

echo "Artefactos generados eliminados (.generated/, public/raw, …)."
