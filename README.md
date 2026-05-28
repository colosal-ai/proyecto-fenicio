# fenicio.es — réplica local y migración

Proyecto para conservar **fenicio.es** (sitio Wix) en Git, espejarlo en local y servir una versión **estática desacoplada** con Astro en Plesk.

## Visión general

```txt
fenicio.es/
├── README.md              # este archivo
├── package.json           # sync / adapt / build clásico → www.fenicio.es + dist/
├── scripts/
│   ├── sync.sh            # sitemaps → urls.txt → mirror en raíz (www + static.*)
│   ├── adapt.mjs          # extrae body sin runtime Wix → src/content/pages/
│   ├── download-wix-originals.sh   # imágenes Wix a resolución original
│   ├── dev-server.mjs     # sirve dist/ en desarrollo
│   └── promote-wget-mirror.sh      # legado: subir mirror anidado en wget/ a raíz

├── www.fenicio.es/        # mirror HTML (fuente principal tras `npm run sync`)
├── static.parastorage.com/   # JS/CSS Wix del mirror (hermano de www.fenicio.es)
├── static.wixstatic.com/     # imágenes versionadas del HTML (opcional, pesado)
├── originals/                # fotos Wix a resolución original
├── src/                   # pipeline “fidelidad visual” (templates, content, dist/)
└── astro/                 # migración Astro: blog, posts, /raw, deploy Plesk
```

Hay **dos líneas de trabajo** complementarias:

| Línea | Carpeta | Objetivo |
|-------|---------|----------|
| Mirror + adaptador | `www.fenicio.es/`, `static.*`, `src/`, `dist/` | Réplica navegable (wget completo) y contenido extraído por página |
| Migración Astro | `astro/` | Sitio estático en producción sin depender del runtime Wix |

Detalle de deploy y scripts Astro: **[astro/README.md](astro/README.md)**.

## Flujo clásico (raíz del repo)

1. **`npm run sync`** — sitemaps, `urls.txt`, mirror wget completo en `www.fenicio.es/` + `static.parastorage.com/` (+ variantes `static.wixstatic.com/`) e imágenes originales en `originals/`.
2. **`npm run adapt`** — genera `src/content/pages/` sin scripts Wix y `routes.json`.
3. **`npm run build`** — copia el mirror a `dist/` con enlaces localizados.
4. **`npm run dev`** — sirve `dist/` en `http://127.0.0.1:8080`.

```bash
npm run prepare   # adapt + build
npm run dev
```

## Flujo Astro (recomendado para producción)

```bash
cd astro
npm install
npm run prepare    # import posts, copia raw, vendorize, build
npm run dev
```

- Posts en `/post/<slug>/`, listado completo en `/blog/todos/` (sustituye el scroll infinito de Wix).
- Páginas Wix archivadas en `/raw/*.html` (referencia; no equivalen al mirror wget con menú hidratado).
- Despliegue: `npm run build` → subir `astro/dist/` a Plesk (ver `astro/README.md`).

## Imágenes Wix

- En el mirror, el HTML suele enlazar **variantes** (`…/v1/fill/w_640,…`).
- Las **originales** (`https://static.wixstatic.com/media/<id>`) se descargan con:

```bash
bash scripts/download-wix-originals.sh
```

Salida por defecto: `originals/static.wixstatic.com/media/` (también al final de `npm run sync`). En Astro: `astro/scripts/backup-post-images.mjs`.

## Qué esperar de cada capa

| Capa | Sirve para | No garantiza |
|------|------------|--------------|
| `www.fenicio.es/` + `static.*` + `originals/` | Mirror HTML+assets y fotos originales en la raíz del repo | Sitio sin Wix ni blog infinito offline |
| `www.fenicio.es/` + CDN local + `dist/` | Navegación local tipo “clon Wix” (`npm run dev` sirve assets CDN) | Desacople total de APIs Wix |
| `astro/dist/` | Producción estática, SEO, todas las entradas del blog | Pixel-perfect del editor Wix en `/raw/` |

## Comandos útiles

```bash
# Mirror completo (HTML + parastorage + wixstatic + originals)
npm run sync

# Solo mirror, sin descargar originales
SYNC_DOWNLOAD_ORIGINALS=0 npm run sync

# Originales Wix (si ya tienes www.fenicio.es/)
bash scripts/download-wix-originals.sh

# Astro local
cd astro && npm run prepare && npm run dev
```
