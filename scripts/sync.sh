#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="https://www.fenicio.es"

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

urls = sorted(dict.fromkeys(urls))
Path("urls.txt").write_text("\n".join(urls) + "\n", encoding="utf-8")
print(f"URLs detectadas: {len(urls)}")
PY

wget \
  --convert-links \
  --adjust-extension \
  --page-requisites \
  --span-hosts \
  --domains fenicio.es,www.fenicio.es \
  --input-file urls.txt

echo "Sincronizacion completada."
