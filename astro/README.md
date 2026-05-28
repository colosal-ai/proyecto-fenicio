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

### Flujos recomendados (rápido)

- **SSH manual dentro del servidor (recomendado para operación diaria):**
  - `npm run deploy:server`
- **Solo actualizar repo + dependencias (sin build/deploy):**
  - `npm run pull:install`
- **Desde tu máquina local hacia servidor (SSH root, ejecución remota como `fenicio.es`):**
  - `npm run deploy:remote`

### Pull + install (solo preparación en servidor)

Si entras por SSH manualmente y solo quieres actualizar código + dependencias:

```bash
cd astro
npm run pull:install
```

Variables opcionales:

- `DEPLOY_BRANCH` (default: `main`)
- `USE_NPM_CI` (default: `1`, usa `0` para `npm install`)

### Install + build + deploy (ejecución manual dentro del servidor)

Si ya estás conectado por SSH al servidor y quieres todo en un único comando:

```bash
cd astro
npm run deploy:server
```

Este comando ejecuta `pull + install + build + deploy` en local (`DEPLOY_LOCAL=1`) y lanza healthcheck final.

### Despliegue automático por SSH (rsync)

```bash
cd astro
npm run deploy:plesk
```

Valores por defecto ya configurados en scripts:

- `PLESK_SSH_TARGET=root@vigorous-pike`
- `PLESK_HTTPDOCS_PATH=/var/www/vhosts/fenicio.es/httpdocs`
- `DEPLOY_OWNER=fenicio.es`
- `DEPLOY_GROUP=psacln`

Si quieres sobrescribirlos puntualmente, exporta variables antes de ejecutar.

### Pull + Build + Deploy en un solo paso

```bash
cd astro
# opcional: export DEPLOY_BRANCH="main"
# opcional: export USE_NPM_CI="1"
npm run deploy:full
```

El script limpia `astro/public/vendor/` antes de hacer `git pull` para evitar bloqueos por archivos generados modificados en servidor.

Si ejecutas el script dentro del propio servidor Plesk (SSH local), evita el salto SSH remoto:

```bash
DEPLOY_LOCAL=1 npm run deploy:full
```

### Despliegue one-click desde tu máquina local (SSH root, ejecución como fenicio.es)

Este flujo entra por SSH como `root`, pero ejecuta la build/deploy como usuario `fenicio.es` en servidor.

```bash
cd astro
npm run deploy:remote
```

Variables opcionales:

- `PLESK_SSH_TARGET` (default: `root@vigorous-pike`)
- `REMOTE_ASTRO_DIR` (default: `/var/www/vhosts/fenicio.es/app/astro`)
- `REMOTE_RUN_AS` (default: `fenicio.es`)
- `DEPLOY_BRANCH` (default: `main`)
- `USE_NPM_CI` (default: `1`)
- `HEALTHCHECK_CONNECT_IP` (default: `127.0.0.1`)

### Variables de entorno útiles (resumen)

- **Git/NPM**
  - `DEPLOY_BRANCH` (default: `main`)
  - `USE_NPM_CI` (default: `1`; si `0` usa `npm install`)
- **Destino Plesk**
  - `PLESK_HTTPDOCS_PATH` (default: `/var/www/vhosts/fenicio.es/httpdocs`)
  - `DEPLOY_OWNER` (default: `fenicio.es`)
  - `DEPLOY_GROUP` (default: `psacln`)
- **Conectividad/healthcheck**
  - `PLESK_SSH_TARGET` (default: `root@vigorous-pike`)
  - `HEALTHCHECK_CONNECT_IP` (default: `127.0.0.1`)
- **Wrapper remoto local->servidor**
  - `REMOTE_ASTRO_DIR` (default: `/var/www/vhosts/fenicio.es/app/astro`)
  - `REMOTE_RUN_AS` (default: `fenicio.es`)

## Fuente de datos actual

`scripts/import-from-mirror.mjs` importa posts desde:

`../src/content/pages/post/*.html`

## Desacople total (fidelidad visual)

- `scripts/vendorize-raw.mjs` procesa `public/raw/**/*.html|css`.
- Reescribe URLs de `fenicio.es`/`www.fenicio.es` a `/raw/...`.
- Descarga recursos externos a `/vendor/...`.
- Elimina `<script>` para evitar dependencia de runtime/API de Wix.
