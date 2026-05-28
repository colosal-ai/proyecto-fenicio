# Línea de migración Astro

Objetivo: migrar el blog a Astro con salida estática para despliegue simple en Plesk, desacoplado de dependencias externas.

## Comandos

```bash
cd astro
npm install
npm run prepare
npm run dev
```

`npm run prepare` ahora:

1. Importa posts desde el mirror local.
2. Copia `www.fenicio.es` a `public/raw`.
3. Descarga assets externos a `public/vendor`.
4. Reescribe enlaces para servir local y elimina runtime de scripts.
5. Genera build estática Astro.

## Despliegue en Plesk

1. Ejecuta `npm run build` en `astro/`.
2. Sube el contenido de `astro/dist/` al `httpdocs` del dominio/subdominio en Plesk.
3. El proyecto incluye `public/.htaccess` para fallback de rutas limpias en Apache.

### Despliegue automático por SSH (rsync)

```bash
cd astro
npm run deploy:plesk
```

Valores por defecto ya configurados en scripts:

- `PLESK_SSH_TARGET=root@vigorous-pike`
- `PLESK_HTTPDOCS_PATH=/var/www/vhosts/fenicio.es/httpdocs`

Si quieres sobrescribirlos puntualmente, exporta variables antes de ejecutar.

### Pull + Build + Deploy en un solo paso

```bash
cd astro
# opcional: export DEPLOY_BRANCH="main"
# opcional: export USE_NPM_CI="1"
npm run deploy:full
```

## Fuente de datos actual

`scripts/import-from-mirror.mjs` importa posts desde:

`../src/content/pages/post/*.html`

## Desacople total (fidelidad visual)

- `scripts/vendorize-raw.mjs` procesa `public/raw/**/*.html|css`.
- Reescribe URLs de `fenicio.es`/`www.fenicio.es` a `/raw/...`.
- Descarga recursos externos a `/vendor/...`.
- Elimina `<script>` para evitar dependencia de runtime/API de Wix.
