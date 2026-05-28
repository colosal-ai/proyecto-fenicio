#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Flujo completo para ejecución directa dentro del servidor:
# pull + install + build + deploy local a httpdocs + healthcheck.
DEPLOY_LOCAL=1 "${ROOT_DIR}/scripts/pull-and-deploy.sh"
