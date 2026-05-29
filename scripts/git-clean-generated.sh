#!/usr/bin/env bash
# Quita del índice Git carpetas generadas (histórico). Los archivos locales se pueden borrar con clean:generated.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

paths=(
  astro/.generated
  astro/public/raw
  astro/public/static.parastorage.com
  astro/public/static.wixstatic.com
  astro/public/originals
  astro/public/vendor
  astro/public/backup
  astro/dist
  astro/node_modules
  astro/.astro
  dist
  node_modules
  .mirror-staging
)

for p in "${paths[@]}"; do
  if git ls-files "$p" 2>/dev/null | grep -q .; then
    git rm -r --cached "$p" 2>/dev/null || true
    echo "Deindexado: $p"
  fi
done

echo "Hecho. En servidor: cd astro && npm run deploy:server"
