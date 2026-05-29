#!/usr/bin/env bash
# Borra salidas de prepare en disco para que git pull/reset no falle.
set -euo pipefail

ASTRO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ASTRO_DIR/.." && pwd)"

GENERATED_PATHS=(
  "$ASTRO_DIR/.generated"
  "$ASTRO_DIR/public/raw"
  "$ASTRO_DIR/public/static.parastorage.com"
  "$ASTRO_DIR/public/static.wixstatic.com"
  "$ASTRO_DIR/public/originals"
  "$ASTRO_DIR/public/vendor"
  "$ASTRO_DIR/public/backup"
  "$ASTRO_DIR/dist"
  "$ASTRO_DIR/.astro"
)

rm -rf "${GENERATED_PATHS[@]}"

cd "$REPO_DIR"
# Restaura índice de rutas que aún estén en Git (clone antiguo) y luego borra otra vez en disco
for rel in \
  astro/public/raw \
  astro/public/static.parastorage.com \
  astro/public/static.wixstatic.com \
  astro/public/originals \
  astro/public/vendor \
  astro/public/backup; do
  if git ls-files "$rel" 2>/dev/null | grep -q .; then
    git restore --worktree --staged "$rel" 2>/dev/null || git checkout HEAD -- "$rel" 2>/dev/null || true
    rm -rf "$rel"
  fi
done

git clean -fd astro/public/raw astro/.generated 2>/dev/null || true

echo "Artefactos generados eliminados."
