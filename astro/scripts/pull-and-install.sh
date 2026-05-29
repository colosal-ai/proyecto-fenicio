#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/.." && pwd)"

BRANCH="${DEPLOY_BRANCH:-main}"
USE_NPM_CI="${USE_NPM_CI:-1}"

detect_npm() {
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return 0
  fi

  local candidates=(
    "/opt/plesk/node/24/bin/npm"
    "/opt/plesk/node/22/bin/npm"
  )

  local npm_path
  for npm_path in "${candidates[@]}"; do
    if [[ -x "$npm_path" ]]; then
      echo "$npm_path"
      return 0
    fi
  done

  return 1
}

echo "==> [1/3] Sincronizando repositorio (rama: ${BRANCH})"
bash "$ROOT_DIR/scripts/clean-generated-public.sh"
cd "$REPO_DIR"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "==> [2/3] Instalando dependencias"
cd "$ROOT_DIR"
NPM_BIN="$(detect_npm || true)"
if [[ -z "$NPM_BIN" ]]; then
  echo "No se encontró npm en PATH ni en /opt/plesk/node/{24,22}/bin/npm"
  exit 1
fi

NODE_BIN_DIR="$(cd "$(dirname "$NPM_BIN")" && pwd)"
export PATH="$NODE_BIN_DIR:$PATH"
echo "Usando npm: $NPM_BIN"
"$NPM_BIN" -v

if [[ "$USE_NPM_CI" == "1" ]]; then
  "$NPM_BIN" ci
else
  "$NPM_BIN" install
fi

echo "==> [3/3] Listo (pull + install completado)"
