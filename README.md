# fenicio.es — réplica local y migración

Proyecto para conservar **fenicio.es** (sitio Wix) en Git, espejarlo en local y servir una versión **estática desacoplada** con Astro en Plesk.

## Sitio congelado (frozen)

El contenido Wix **ya está archivado en el repo**. No hace falta volver a descargarlo salvo que quieras un re-crawl explícito desde el sitio en vivo.

**Fuente de verdad en Git:**

```txt
www.fenicio.es/              # HTML del sitio (28 páginas)
static.parastorage.com/      # JS/CSS Wix (menú, Thunderbolt)
static.wixstatic.com/        # imágenes versionadas que enlaza el HTML
originals/static.wixstatic.com/media/   # fotos originales (sin /v1/fill/)
src/content/pages/           # HTML adaptado (sin runtime Wix), para Astro/adapt
```

**No ejecutar** `npm run sync` en el día a día. Ese comando es el **único** que vuelve a bajar el sitio desde Wix.

### Qué toca red y qué no

| Comando (raíz) | ¿Descarga Wix? | Qué hace |
|----------------|----------------|----------|
| `npm run sync` | **Sí** | Re-crawl completo (solo mantenimiento excepcional) |
| `npm run adapt` | No | `www.fenicio.es/` → `src/content/pages/` |
| `npm run build` | No | mirror → `dist/` |
| `npm run prepare` | No | `adapt` + `build` |
| `npm run dev` | No | Sirve `dist/` + CDN local en `http://127.0.0.1:8080` |

| Comando (`astro/`) | ¿Re-crawl Wix? | Qué hace |
|--------------------|----------------|----------|
| `npm run dev` | No | Servidor de desarrollo Astro |
| `npm run prepare` | No | Importa posts, copia raw, vendorize, build (lee archivos locales) |
| `npm run build` | No | Build estático → `astro/dist/` |

`npm run dev` **nunca** sustituye a `sync`: solo lee lo que ya está en disco.

### Flujo habitual (sitio frozen)

```bash
# Ver clon Wix local (mirror + menú con assets locales)
npm run prepare   # solo si regeneras dist/ o src/content tras cambios manuales
npm run dev

# Astro (producción / desarrollo)
cd astro && npm run prepare && npm run dev
```

Tras `git clone`: no hace falta `sync`; el mirror y las originales vienen en el commit.

## Visión general

```txt
fenicio.es/
├── README.md
├── package.json           # adapt / build / dev (sync solo mantenimiento)
├── scripts/
│   ├── sync.sh            # re-crawl Wix → raíz (excepcional)
│   ├── adapt.mjs          # extrae body sin runtime Wix → src/content/pages/
│   ├── download-wix-originals.sh   # originales desde HTML local (sin sync)
│   ├── build.mjs
│   └── dev-server.mjs     # sirve dist/ + static.* + originals/
├── www.fenicio.es/
├── static.parastorage.com/
├── static.wixstatic.com/
├── originals/
├── src/content/pages/     # generado por adapt; commiteado para Astro
└── astro/                 # migración Astro, deploy Plesk
```

| Línea | Carpetas | Objetivo |
|-------|----------|----------|
| Mirror + adaptador | `www.fenicio.es/`, `static.*`, `src/`, `dist/` | Réplica navegable y contenido extraído |
| Migración Astro | `astro/` | Sitio estático en producción |

Detalle Astro/deploy: **[astro/README.md](astro/README.md)**.

## Re-crawl (solo si hiciera falta)

```bash
npm run sync
npm run adapt          # regenerar src/content
cd astro && npm run prepare
```

Variables: `SYNC_DOWNLOAD_ORIGINALS=0` (mirror sin re-descargar originales), `WGET_WAIT`, `WGET_RATE`.

## Imágenes Wix

| Ubicación | Contenido |
|-----------|-----------|
| `static.wixstatic.com/` | Variantes del HTML (`/v1/fill/…`) |
| `originals/…/media/` | Archivo fuente (`https://static.wixstatic.com/media/<id>`) |

Regenerar solo originales desde HTML local (sin sync):

```bash
bash scripts/download-wix-originals.sh
```

En Astro: `astro/scripts/backup-post-images.mjs`.

## Qué esperar de cada capa

| Capa | Sirve para | No garantiza |
|------|------------|--------------|
| Mirror + `static.*` + `originals/` | Archivo y navegación local | Blog infinito offline ni cero dependencia Wix |
| `dist/` + `npm run dev` | Clon local con menú (assets en disco) | Idéntico al vivo sin red en APIs `siteassets` |
| `astro/dist/` | Producción estática, blog completo | Pixel-perfect de `/raw/` Wix |

## Comandos rápidos

```bash
npm run prepare && npm run dev
cd astro && npm run prepare && npm run dev
```
