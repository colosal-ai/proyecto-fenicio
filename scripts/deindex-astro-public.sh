#!/usr/bin/env bash
# Quita del índice Git todo astro/public/* generado (ejecutar en dev, luego commit).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

remove_index() {
  local p="$1"
  local listed
  listed="$(git ls-files "$p" 2>/dev/null || true)"
  if [[ -z "$listed" ]]; then
    return 0
  fi
  echo "$listed" | while read -r f; do
    [[ -n "$f" ]] && git rm --cached -f "$f"
  done
  echo "Deindexado: $p"
}

for p in \
  astro/public/raw \
  astro/public/static.parastorage.com \
  astro/public/static.wixstatic.com \
  astro/public/originals \
  astro/public/vendor \
  astro/public/backup; do
  remove_index "$p"
done

echo "Listo. Revisa: git status"
