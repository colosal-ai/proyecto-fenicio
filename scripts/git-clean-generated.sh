#!/usr/bin/env bash
# Quita del índice Git carpetas generadas por Astro (prepare). Los archivos siguen en disco.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

paths=(
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
  if git ls-files --error-unmatch "$p" >/dev/null 2>&1 || git ls-files "$p" | grep -q .; then
    git rm -r --cached "$p" 2>/dev/null || true
    echo "Deindexado: $p"
  fi
done

echo "Hecho. Revisa: git status"
echo "Tras commit, en clone/deploy: cd astro && npm run prepare"
