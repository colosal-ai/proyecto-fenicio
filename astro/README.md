# Astro migration line

Objetivo: migrar el blog a Astro con salida estatica para despliegue simple en Plesk.

## Comandos

```bash
cd astro
npm install
npm run prepare
npm run dev
```

## Despliegue en Plesk

1. Ejecuta `npm run build` en `astro/`.
2. Sube el contenido de `astro/dist/` al `httpdocs` del dominio/subdominio en Plesk.
3. Asegura fallback de rutas:
   - si usas Apache, activa `AllowOverride` y usa `.htaccess` para rutas limpias.
   - alternativa simple: servir enlaces con slash final (`/post/slug/`) como ya genera Astro.

## Fuente de datos actual

`scripts/import-from-mirror.mjs` importa posts desde:

`../src/content/pages/post/*.html`
