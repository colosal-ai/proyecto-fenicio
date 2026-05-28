# fenicio.es (local mantenible)

Réplica local basada en mirror + pipeline de adaptación para poder mantener el proyecto en Git con una estructura clara.

## Flujo

1. `npm run sync`
   - Actualiza `sitemap.xml`, `pages-sitemap.xml`, `blog-posts-sitemap.xml`.
   - Reconstruye `urls.txt`.
   - Descarga/actualiza HTMLs en `www.fenicio.es/`.
2. `npm run adapt`
   - Extrae `<body>` de cada HTML de `www.fenicio.es/`.
   - Genera contenidos de página en `src/content/pages/`.
   - Elimina runtime de scripts Wix del contenido para ejecución local estática.
   - Reescribe enlaces internos a rutas canónicas locales.
   - Genera inventario de rutas en `src/content/routes.json`.
3. `npm run build`
   - Modo fidelidad visual: copia `www.fenicio.es/` a `dist/`.
   - Localiza enlaces absolutos del dominio para mantener navegación local.
4. `npm run dev`
   - Sirve `dist/` en `http://127.0.0.1:8080`.

## Comandos rápidos

```bash
npm run prepare
npm run dev
```

## Estructura

```txt
scripts/
  sync.sh
  adapt.mjs
  build.mjs
  dev-server.mjs
src/
  content/routes.json
  content/pages/        # contenido desacoplado por página (generado)
  public/styles.css
  templates/structure.html
  templates/page.html
www.fenicio.es/         # mirror crudo
dist/                   # salida final (fidelidad visual)
```
