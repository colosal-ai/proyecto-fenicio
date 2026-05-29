#!/usr/bin/env bash
# DEPRECADO: el archivo ya está en originals/ (Git). No vuelve a descargar de Wix.
set -euo pipefail

if [[ "${ALLOW_WIX_DOWNLOAD:-}" != "1" ]]; then
  echo "DEPRECADO: download-wix-originals.sh (requiere red a Wix)." >&2
  echo "Usa el contenido en originals/static.wixstatic.com/media/ y: cd astro && npm run prepare" >&2
  echo "Solo emergencia: ALLOW_WIX_DOWNLOAD=1 bash scripts/download-wix-originals.sh" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Directorios HTML a escanear (argumentos o defaults del mirror wget)
HTML_DIRS=()
if [[ $# -gt 0 ]]; then
  HTML_DIRS=("$@")
else
  for candidate in \
    "www.fenicio.es" \
    "wget/wget/www.fenicio.es" \
    "wget/www.fenicio.es"; do
  if [[ -d "$candidate" ]]; then
    HTML_DIRS+=("$candidate")
  fi
  done
fi

if [[ ${#HTML_DIRS[@]} -eq 0 ]]; then
  echo "No se encontró mirror HTML. Pasa la ruta: $0 wget/wget/www.fenicio.es"
  exit 1
fi

OUT_DIR="${WIX_ORIGINALS_DIR:-originals/static.wixstatic.com/media}"
URL_LIST="${WIX_ORIGINALS_LIST:-originals/wix-originals.txt}"

mkdir -p "$(dirname "$URL_LIST")" "$OUT_DIR"

# Solo jpg/jpeg/png: el original en Wix suele ser ~mv2.jpg; .webp directo suele dar 403.
grep -rhoE '344230_[A-Za-z0-9_.~-]+\.(jpg|jpeg|png)' "${HTML_DIRS[@]}" 2>/dev/null \
  | sort -u \
  | while read -r id; do
      echo "https://static.wixstatic.com/media/${id}"
    done > "$URL_LIST"

COUNT=$(wc -l < "$URL_LIST" | tr -d ' ')
echo "IDs Wix únicos: ${COUNT}"
echo "Lista: ${URL_LIST}"
echo "Destino: ${OUT_DIR}/"

if ! wget -nc \
  -P "$OUT_DIR" \
  --input-file="$URL_LIST" \
  --execute robots=off \
  --user-agent="Mozilla/5.0 (compatible; FenicioWixOriginals/1.0)" \
  --progress=dot:giga; then
  echo "Aviso: wget terminó con errores parciales (revisa URLs fallidas arriba)."
fi

DOWNLOADED=$(find "$OUT_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')
echo "Hecho. ${DOWNLOADED} archivos en ${OUT_DIR}/"
