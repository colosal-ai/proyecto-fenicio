# fenicio.es — archivo Git y sitio Astro

Réplica **congelada** del sitio Wix y generación estática con Astro. El dominio en producción **no** usa Wix; todo el contenido debe estar en este repositorio.

## Inicio rápido (local)

```bash
git clone <URL-del-repo>
cd astro
npm install
npm run prepare
npm run dev     # http://127.0.0.1:4321/
```

`npm run prepare` solo lee archivos del disco (sin descargar de Wix).

## Contenido que debe estar en Git

```txt
www.fenicio.es/                         # HTML mirror
static.parastorage.com/                 # JS/CSS Wix
static.wixstatic.com/                   # variantes de imágenes
originals/static.wixstatic.com/media/   # fotos originales (portadas del blog)
src/content/pages/                      # posts adaptados para Astro
astro/                                  # build y despliegue
```

Sin `originals/` y `static.*`, el blog y `/raw/` pueden quedar sin imágenes.

## Despliegue en servidor

Guía completa: **[astro/README.md](astro/README.md)** (sección *Despliegue en servidor*).

**Resumen** — tras `git push`:

```bash
# En el servidor (dentro del clone)
cd /var/www/vhosts/fenicio.es/app/astro
/opt/plesk/node/24/bin/npm run deploy:server
```

O desde tu PC:

```bash
cd astro && npm run deploy:remote
```

Eso hace: `git pull` → `npm ci` → `npm run prepare` → copiar `dist/` a `httpdocs`.

## Mirror clásico en local (`:8080`)

Opcional; sirve el adaptador en `dist/` de la raíz del repo:

```bash
npm run prepare && npm run dev    # raíz del repo, puerto 8080
```

## Scripts deprecados (no usar en operación normal)

| Script | Motivo |
|--------|--------|
| `npm run sync` (raíz) | Re-crawl Wix; solo `ALLOW_WIX_SYNC=1` |
| `scripts/download-wix-originals.sh` | Solo `ALLOW_WIX_DOWNLOAD=1` |
| `astro`: `vendorize:raw`, `backup:post-images` | Sustituidos por `link:assets` + `originals/` |

## Rutas en producción (Astro)

| Ruta | Contenido |
|------|-----------|
| `/` | Home archivada (redirect) |
| `/blog/` | Blog completo |
| `/post/<slug>/` | Entrada |
| `/raw/*` | Páginas Wix (equipo, embarcación, etc.) |
