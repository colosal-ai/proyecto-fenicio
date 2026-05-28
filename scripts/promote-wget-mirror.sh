#!/usr/bin/env bash
# Promueve un mirror wget anidado (p. ej. wget/www.fenicio.es) a la raíz del repo.
# Legado: npm run sync ya escribe directamente en www.fenicio.es/ y static.*.
# Ejecutar SIEMPRE desde la raíz: bash scripts/promote-wget-mirror.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$(pwd)" != "$ROOT_DIR" ]]; then
  echo "Ejecuta desde la raíz del repo: cd $ROOT_DIR && bash scripts/promote-wget-mirror.sh"
  exit 1
fi

# Rutas posibles del mirror completo (según desde dónde se lanzó wget)
CANDIDATES=(
  "wget/wget"
  "wget"
)

MIRROR_BASE=""
for base in "${CANDIDATES[@]}"; do
  if [[ -d "$base/www.fenicio.es" ]] && [[ $(find "$base/www.fenicio.es" -name '*.html' | wc -l) -gt 5 ]]; then
    MIRROR_BASE="$base"
    break
  fi
done

if [[ -z "$MIRROR_BASE" ]]; then
  echo "No se encontró un mirror wget completo (www.fenicio.es con varias páginas HTML)."
  echo "Usa: npm run sync"
  exit 1
fi

echo "Mirror detectado en: $MIRROR_BASE/"

for target in www.fenicio.es static.parastorage.com static.wixstatic.com; do
  rm -rf "$target"
  if [[ -d "$MIRROR_BASE/$target" ]]; then
    mv "$MIRROR_BASE/$target" .
    echo "  + $target"
  fi
done

# Originales: wget/originals → originals/
if [[ -d wget/originals ]] && [[ ! -d originals ]]; then
  mv wget/originals originals
  echo "  + originals/ (desde wget/originals)"
elif [[ -d wget/originals/static.wixstatic.com/media ]]; then
  mkdir -p originals
  rm -rf originals/static.wixstatic.com
  mv wget/originals/static.wixstatic.com originals/
  echo "  + originals/ (fusionado desde wget/originals)"
fi

HTML_COUNT=$(find www.fenicio.es -name '*.html' | wc -l | tr -d ' ')
echo "Listo. Páginas HTML en www.fenicio.es/: ${HTML_COUNT}"
echo "Siguiente: npm run prepare && npm run dev"
