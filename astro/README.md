# Línea de migración Astro

Sitio **offline** tras `git clone`: el contenido vive en el repo (`www.fenicio.es/`, `static.*`, `originals/`, `src/content/`). El build **no** descarga de Wix.

## Instalación local (desarrollo)

```bash
cd astro
npm install
npm run prepare    # sync:content + link:assets + build
npm run dev        # http://127.0.0.1:4321/
```

### Qué hace `npm run prepare`

| Paso | Script | Acción |
|------|--------|--------|
| 1 | `sync:content` | `posts.json`, copia mirror → `public/raw`, `originals/`, `static.*` |
| 2 | `link:assets` | Reescribe URLs en `public/raw` a rutas locales (sin red) |
| 3 | `build` | Genera `dist/` (sitio estático para producción) |

Solo necesita **npm** (para instalar Astro) y **git** con el repo completo; no hace falta `wget` ni acceso a Wix.

### Scripts deprecados

| No usar | Usar en su lugar |
|---------|------------------|
| `npm run vendorize:raw` | `npm run link:assets` |
| `npm run backup:post-images` | `sync:content` + `originals/` en Git |
| Raíz: `npm run sync` | Contenido ya en Git |
| `scripts/download-wix-originals.sh` | `originals/` en Git |

Emergencia (solo con red a Wix): `ALLOW_WIX_SYNC=1 npm run sync` en la raíz del repo.

---

## Despliegue en servidor (Plesk)

Lo que sirve el dominio es **`astro/dist/`** copiado a `httpdocs`. El código fuente y el mirror quedan fuera del document root (recomendado).

### Requisitos en el servidor

- **Git**: repo completo clonado (no solo la carpeta `astro/`).
- **Node.js + npm**: Plesk suele tenerlos en `/opt/plesk/node/24/bin/npm` o `.../22/bin/npm`.
- **Rsync** (para publicar `dist/` → `httpdocs`).
- Acceso SSH al servidor (root o usuario con permisos en `httpdocs`).

### Estructura recomendada en el servidor

```txt
/var/www/vhosts/fenicio.es/
├── app/                          # clone Git (privado, fuera de httpdocs)
│   ├── www.fenicio.es/
│   ├── static.parastorage.com/
│   ├── static.wixstatic.com/
│   ├── originals/
│   ├── src/content/
│   └── astro/                    # aquí se ejecutan npm y el build
│       ├── package.json
│       ├── dist/                 # generado por prepare (no commitear)
│       └── scripts/
└── httpdocs/                     # document root público (= contenido de dist/)
```

### Primera instalación en el servidor

Conéctate por SSH y clona el repo (ajusta URL y rama):

```bash
# Como root o usuario con acceso al vhost
mkdir -p /var/www/vhosts/fenicio.es/app
cd /var/www/vhosts/fenicio.es/app
git clone <URL-del-repo> .
git checkout main

cd astro
/opt/plesk/node/24/bin/npm install    # o: npm install si está en PATH
/opt/plesk/node/24/bin/npm run prepare
```

Publicar por primera vez:

```bash
cd /var/www/vhosts/fenicio.es/app/astro
DEPLOY_LOCAL=1 npm run deploy:server
```

Eso ejecuta: `git pull` → `npm ci` → `npm run prepare` → `rsync dist/` → `httpdocs` → healthcheck.

### Actualizar producción (cada cambio que subas a Git)

**En tu máquina:**

```bash
git add …
git commit -m "…"
git push origin main
```

**En el servidor** (método habitual, ya dentro del clone):

```bash
cd /var/www/vhosts/fenicio.es/app/astro
/opt/plesk/node/24/bin/npm run deploy:server
```

**Desde tu máquina** (un solo comando vía SSH; no entras al servidor):

```bash
cd astro
npm run deploy:remote
```

Esto entra como `root@vigorous-pike`, ejecuta el build como usuario `fenicio.es` y ajusta permisos de `httpdocs`.

### Otros comandos útiles

| Comando | Cuándo |
|---------|--------|
| `npm run pull:install` | Solo `git pull` + `npm ci` (sin build ni publicar) |
| `npm run build` | Solo regenerar `dist/` (tras `prepare` previo o cambios menores) |
| `npm run deploy:plesk` | Publicar `dist/` por rsync SSH (sin pull; asume `dist/` ya generado) |
| `DEPLOY_LOCAL=1 npm run deploy:full` | Igual que `deploy:server` (alias vía `pull-and-deploy.sh`) |
| `npm run healthcheck:local` | Comprueba rutas en Apache local (`Host: fenicio.es`) |

### Variables de entorno (opcionales)

| Variable | Default | Uso |
|----------|---------|-----|
| `DEPLOY_BRANCH` | `main` | Rama a desplegar |
| `USE_NPM_CI` | `1` | `npm ci` (`0` → `npm install`) |
| `PLESK_HTTPDOCS_PATH` | `/var/www/vhosts/fenicio.es/httpdocs` | Destino público |
| `PLESK_SSH_TARGET` | `root@vigorous-pike` | SSH para `deploy:remote` / `deploy:plesk` |
| `REMOTE_ASTRO_DIR` | `/var/www/vhosts/fenicio.es/app/astro` | Ruta del proyecto en el servidor |
| `REMOTE_RUN_AS` | `fenicio.es` | Usuario que ejecuta el build en remoto |
| `DEPLOY_OWNER` / `DEPLOY_GROUP` | `fenicio.es` / `psacln` | Owner de archivos en `httpdocs` |
| `HEALTHCHECK_CONNECT_IP` | `127.0.0.1` | IP para curl al vhost local |

Ejemplo con rama distinta:

```bash
DEPLOY_BRANCH=main USE_NPM_CI=1 npm run deploy:server
```

### Publicación manual (sin scripts)

Si prefieres hacerlo a mano tras un `prepare`:

```bash
cd /var/www/vhosts/fenicio.es/app/astro
npm run prepare
rsync -av --delete dist/ /var/www/vhosts/fenicio.es/httpdocs/
chown -R fenicio.es:psacln /var/www/vhosts/fenicio.es/httpdocs
```

### Qué se publica y qué no

| Se copia a `httpdocs` | No se expone |
|----------------------|--------------|
| Contenido de `astro/dist/` | `www.fenicio.es/`, `originals/`, fuentes en `src/` |
| `.htaccess` (desde `public/`) | `node_modules/`, scripts de build |

El build **empaqueta** en `dist/` lo necesario (`raw/`, `static.*`, `originals/`, blog Astro, posts).

### Comprobación tras desplegar

```bash
curl -sI -H 'Host: fenicio.es' http://127.0.0.1/ | head -5
curl -sI -H 'Host: fenicio.es' http://127.0.0.1/blog/todos/ | head -5
```

O: `npm run healthcheck:local` dentro de `astro/`.

### Inicio `/` → `/raw/index.html`

- `public/index.html` hace un salto directo (meta refresh) a la home archivada.
- En Apache, `.htaccess` reescribe `/` → `/raw/index.html` sin pasar por Astro.
- **No** uses `redirects` en `astro.config.mjs`: en `astro dev` Astro muestra una pantalla *“Redirecting from / to …”* que parece un bloqueo del navegador, pero es solo el modo desarrollo.

---

## Fuente de datos

- Posts: `../src/content/pages/post/*.html` + `og:image` en `../www.fenicio.es/post/*.html`.
- Imágenes: `../originals/static.wixstatic.com/media/` (prioridad) y `../static.wixstatic.com/`.

## Rutas del sitio

| Ruta | Descripción |
|------|-------------|
| `/` | Redirige a home archivada (`/raw/index.html`) |
| `/raw/*` | Páginas Wix archivadas |
| `/blog/todos/` | Listado completo de entradas |
| `/post/<slug>/` | Entrada migrada |
