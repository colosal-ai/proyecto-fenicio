#!/usr/bin/env bash
# Mirror completo (HTML + static.parastorage + static.wixstatic) → www.fenicio.es/ en la raíz del repo.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="https://www.fenicio.es"
STAGING_DIR="${SYNC_STAGING_DIR:-.mirror-staging}"
WGET_WAIT="${WGET_WAIT:-1}"
WGET_RATE="${WGET_RATE:-500k}"
DOWNLOAD_ORIGINALS="${SYNC_DOWNLOAD_ORIGINALS:-1}"

echo "==> Sitemaps y urls.txt"
curl -sL "$BASE_URL/robots.txt" -o robots.txt
curl -sL "$BASE_URL/sitemap.xml" -o sitemap.xml
curl -sL "$BASE_URL/pages-sitemap.xml" -o pages-sitemap.xml
curl -sL "$BASE_URL/blog-posts-sitemap.xml" -o blog-posts-sitemap.xml

python3 - <<'PY'
import re
from pathlib import Path

files = ["pages-sitemap.xml", "blog-posts-sitemap.xml"]
urls = []
for file in files:
    text = Path(file).read_text(encoding="utf-8", errors="ignore")
    urls.extend(re.findall(r"<loc>(.*?)</loc>", text))

# Paginación del blog (no siempre está en el sitemap).
urls.append("https://www.fenicio.es/blog/page/2")

urls = sorted(dict.fromkeys(urls))
Path("urls.txt").write_text("\n".join(urls) + "\n", encoding="utf-8")
print(f"URLs detectadas: {len(urls)}")
PY

echo "==> wget mirror (staging: ${STAGING_DIR})"
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

WGET_OPTS=(
  --mirror
  --convert-links
  --adjust-extension
  --page-requisites
  --span-hosts
  --domains=www.fenicio.es,fenicio.es,static.wixstatic.com,static.parastorage.com
  --execute robots=off
  --random-wait
  --wait="$WGET_WAIT"
  --limit-rate="$WGET_RATE"
  --user-agent="Mozilla/5.0 (compatible; FenicioSync/1.0)"
  --input-file="$ROOT_DIR/urls.txt"
)

if ! (cd "$STAGING_DIR" && wget "${WGET_OPTS[@]}"); then
  echo "Aviso: wget terminó con errores parciales (revisa la salida)."
fi

echo "==> Promover mirror a la raíz del repo"
for target in www.fenicio.es static.parastorage.com static.wixstatic.com; do
  rm -rf "$target"
  if [[ -d "$STAGING_DIR/$target" ]]; then
    mv "$STAGING_DIR/$target" .
    echo "  + $target"
  fi
done
rm -rf "$STAGING_DIR"

if [[ ! -d www.fenicio.es ]]; then
  echo "Error: no se generó www.fenicio.es/ en el staging."
  exit 1
fi

HTML_COUNT=$(find www.fenicio.es -name '*.html' | wc -l | tr -d ' ')
echo "Mirror HTML: ${HTML_COUNT} páginas en www.fenicio.es/"

if [[ "$DOWNLOAD_ORIGINALS" == "1" ]]; then
  echo "==> Imágenes Wix originales"
  WIX_ORIGINALS_DIR="originals/static.wixstatic.com/media" \
  WIX_ORIGINALS_LIST="originals/wix-originals.txt" \
    bash scripts/download-wix-originals.sh www.fenicio.es
fi

echo "Sincronización completada."
