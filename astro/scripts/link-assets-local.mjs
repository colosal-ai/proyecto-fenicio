/**
 * Reescribe .generated/raw desde assets del repo (sin red).
 * Sustituye a vendorize-raw.mjs (deprecado).
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const REPO_ROOT = path.resolve(ROOT, "..");
const RAW_DIR = path.join(ROOT, ".generated", "raw");
const ORIGINALS_DIR = path.join(ROOT, ".generated", "originals/static.wixstatic.com/media");
const PARASTORAGE_PUBLIC = "/static.parastorage.com";
const WIXSTATIC_PUBLIC = "/static.wixstatic.com";

const KEEP_EXTERNAL_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "player.vimeo.com",
  "vimeo.com",
  "i.ytimg.com"
]);

function unescapeSlashes(value) {
  return value.replaceAll("\\/", "/");
}

function rewriteSameHost(urlString) {
  try {
    const u = new URL(urlString);
    if (u.hostname !== "www.fenicio.es" && u.hostname !== "fenicio.es") return null;
    if (u.pathname === "/blog" || u.pathname.startsWith("/blog/")) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    if (u.pathname.startsWith("/post/")) {
      const clean = u.pathname.replace(/\/+$/, "");
      return `${clean}/${u.search}${u.hash}`.replace("/?", "?").replace("/#", "#");
    }
    if (/^\/[^/]+\.html$/i.test(u.pathname)) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    return `/raw${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

/** URL pública (barra del navegador) para un HTML del mirror en raw/. */
function publicUrlForRawHtml(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized === "index.html") return "/";
  return `/${normalized}`;
}

/** Alinea JSON Wix con rutas públicas (/equipo.html) en lugar de /raw/… */
function normalizeWixPublicBaseUrls(content, relativePath) {
  const publicUrl = publicUrlForRawHtml(relativePath);
  const requestPath = publicUrl === "/" ? "/" : publicUrl.replace(/\.html$/i, "");

  let out = content;
  out = out.replaceAll('"externalBaseUrl":"/raw/"', '"externalBaseUrl":"/"');
  out = out.replaceAll('"externalBaseUrl":"\\/raw\\/"', '"externalBaseUrl":"\\/"');
  out = out.replaceAll('"/raw/_api/', '"/_api/');
  out = out.replaceAll('"\\/raw\\/_api', '"\\/_api');
  out = out.replaceAll('"/raw/"', '"/"');
  out = out.replace(/"requestUrl":"\/raw[^"]*"/g, `"requestUrl":"${requestPath}"`);
  return out;
}

const ARCHIVE_LAYOUT_FIX = `<style id="fenicio-archive-layout">
/* Sin Thunderbolt: menú horizontal y centrado en cabecera (layout 980px intacto) */
#comp-ju1005uj.hidden-during-prewarmup{visibility:visible!important}
#comp-ju1005uj,#comp-ju1005uj .pols_4,#comp-ju1005uj nav{height:50px}
#comp-ju1005uj .wTjmlM{display:flex;flex-direction:row;align-items:center;justify-content:center;height:100%;text-align:center}
#comp-ju1005uj .agzDLy{display:inline-flex;align-items:center;height:100%;--display:inline-flex}
#comp-ju1005uj .wNTNML,#comp-ju1005uj .MKZTGU{display:flex;align-items:center;height:100%}
#SITE_HEADER [data-mesh-id="SITE_HEADERinlineContent-gridContainer"]{align-items:center}
/* Ocultar ítem "More" del menú Wix y anclas de scroll sin JS */
#comp-ju1005uj__more__,li[id$="__more__"]{display:none!important}
#SCROLL_TO_TOP,#SCROLL_TO_BOTTOM{display:none!important}
/* Pie Wix del mirror: vacío pero con franja gris (--color_39); sin JS no aporta */
#SITE_FOOTER{display:none!important}
/* Móvil: no re-fluidificar; scroll horizontal del lienzo 980px */
@media (max-width:999px){
html{overflow-x:auto}
body{min-width:0}
#SITE_CONTAINER{min-width:980px}
}
</style>`;

/** Quita el ítem "More" del dropdown Wix en HTML. */
function removeWixMoreMenuItem(content) {
  return content.replace(/<li\b[^>]*\bid="[^"]*__more__"[^>]*>[\s\S]*?<\/li>/gi, "");
}

function injectArchiveLayoutFix(content) {
  if (content.includes('id="fenicio-archive-layout"')) return content;
  if (/<\/head>/i.test(content)) {
    return content.replace(/<\/head>/i, `${ARCHIVE_LAYOUT_FIX}</head>`);
  }
  return `${ARCHIVE_LAYOUT_FIX}${content}`;
}

/** Crema del tema Wix (--color_11: 248,244,241) semitransparente sobre el bloque de texto. */
const FENICIO_CREAM_OVERLAY = "rgba(248, 244, 241, 0.84)";

const TEXT_OVERLAY_BY_PAGE = {
  "index.html": "comp-lm3cvp8rinlineContent",
  "embarcación.html": "comp-ljgz0u32inlineContent"
};

function injectPageTextOverlay(content, relativePath) {
  const meshId = TEXT_OVERLAY_BY_PAGE[relativePath];
  if (!meshId) return content;

  const overlayStyle = `<style id="fenicio-text-overlay">
[data-mesh-id="${meshId}"]{
  position:relative;
  z-index:2;
  background-color:${FENICIO_CREAM_OVERLAY}!important;
  padding:1.25rem 1.75rem!important;
  box-sizing:border-box;
}
</style>`;

  if (content.includes('id="fenicio-text-overlay"')) return content;
  if (/<\/head>/i.test(content)) {
    return content.replace(/<\/head>/i, `${overlayStyle}</head>`);
  }
  return `${overlayStyle}${content}`;
}

function wixAssetIdFromPath(pathname) {
  const m = pathname.match(WIX_ASSET_ID);
  return m ? m[1] : "";
}

const ORIGINALS_PUBLIC_PREFIX = "/originals/static.wixstatic.com/media";
const WIX_ASSET_ID = /(344230_[A-Za-z0-9_.~-]+\.(?:jpg|jpeg|png|webp|avif))/i;
/** No matchear /originals/static.wixstatic.com/… (evita /originals/originals/…). */
const WIX_MEDIA_URL =
  /(?:https?:\/\/static\.wixstatic\.com\/media\/|(?<!\/originals\/)\/static\.wixstatic\.com\/media\/)(344230_[A-Za-z0-9_.~-]+\.(?:jpg|jpeg|png|webp|avif))(?:\/[^"'\\)\s<>]*)?/gi;

function originalPublicUrl(assetId) {
  if (!assetId || !existsSync(path.join(ORIGINALS_DIR, assetId))) return "";
  return `${ORIGINALS_PUBLIC_PREFIX}/${assetId}`;
}

function walkMirrorImageFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMirrorImageFiles(full, files);
      continue;
    }
    if (/\.(jpe?g|png|webp|avif)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

/** Mayor w_ en la ruta; penaliza blur; desempata por tamaño en disco. */
function scoreMirrorVariant(filePath) {
  const rel = filePath.replace(/\\/g, "/");
  let score = 0;
  if (/blur/i.test(rel)) score -= 1_000_000;
  const widthMatch = rel.match(/\/w_(\d+)/i);
  if (widthMatch) score += Number.parseInt(widthMatch[1], 10) * 1000;
  try {
    score += Math.floor(statSync(filePath).size / 100);
  } catch {
    // ignore
  }
  return score;
}

function largestMirrorVariantPublicUrl(assetId) {
  const mediaDir = path.join(REPO_ROOT, "static.wixstatic.com/media", assetId);
  if (!existsSync(mediaDir)) return "";
  let st;
  try {
    st = statSync(mediaDir);
  } catch {
    return "";
  }
  if (st.isFile()) return `${WIXSTATIC_PUBLIC}/media/${assetId}`;
  if (!st.isDirectory()) return "";

  const files = walkMirrorImageFiles(mediaDir);
  if (!files.length) return "";

  const best = files.sort((a, b) => scoreMirrorVariant(b) - scoreMirrorVariant(a))[0];
  const rel = path
    .relative(path.join(REPO_ROOT, "static.wixstatic.com"), best)
    .replace(/\\/g, "/");
  return `${WIXSTATIC_PUBLIC}/${rel}`;
}

/** URL local de máxima calidad para un asset Wix (original > archivo plano > mejor /v1/fill/). */
function bestLocalUrlForAssetId(assetId) {
  if (!assetId) return "";
  const fromOriginal = originalPublicUrl(assetId);
  if (fromOriginal) return fromOriginal;
  return largestMirrorVariantPublicUrl(assetId);
}

function findMirrorWixPath(assetId, pathname) {
  if (!assetId) return "";
  const best = bestLocalUrlForAssetId(assetId);
  if (best) return best;

  const relFromUrl = pathname.replace(/^\/+/, "");
  if (/\/v1\/fill\//i.test(relFromUrl)) return "";

  const exact = path.join(REPO_ROOT, "static.wixstatic.com", relFromUrl);
  if (existsSync(exact)) return `${WIXSTATIC_PUBLIC}/${relFromUrl}`;
  return "";
}

function upgradeWixMediaUrls(content) {
  return content.replace(WIX_MEDIA_URL, (match, assetId) => {
    const best = bestLocalUrlForAssetId(assetId);
    return best || match;
  });
}

function localUrlForAbsolute(urlString) {
  const normalized = unescapeSlashes(urlString);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }

  if (KEEP_EXTERNAL_HOSTS.has(parsed.hostname)) return normalized;

  const sameHost = rewriteSameHost(normalized);
  if (sameHost) return sameHost;

  if (parsed.hostname === "static.parastorage.com") {
    const rel = parsed.pathname + parsed.search;
    const src = path.join(REPO_ROOT, "static.parastorage.com", rel.replace(/^\//, ""));
    if (existsSync(src)) return `${PARASTORAGE_PUBLIC}${rel}`;
  }

  if (parsed.hostname === "static.wixstatic.com") {
    const assetId = wixAssetIdFromPath(parsed.pathname);
    const local = findMirrorWixPath(assetId, parsed.pathname);
    if (local) return local;
  }

  // vendor/ legado (si quedó en Git de una build anterior)
  if (parsed.hostname === "siteassets.parastorage.com") {
    const vendorRel = path.join(ROOT, "public/vendor", parsed.hostname, parsed.pathname);
    if (existsSync(vendorRel)) {
      return `/vendor/${parsed.hostname}${parsed.pathname}`;
    }
  }

  return null;
}

function normalizeRelativeMirrorPaths(content) {
  return content
    .replace(/(?:\.\.\/)+static\.parastorage\.com\//g, `${PARASTORAGE_PUBLIC}/`)
    .replace(/(?:\.\.\/)+originals\//g, "/originals/")
    .replace(/(?:\.\.\/)+static\.wixstatic\.com\//g, `${WIXSTATIC_PUBLIC}/`);
}

function dedupeOriginalsPublicPrefix(content) {
  return content.replaceAll("/originals/originals/", "/originals/");
}

function stripScripts(content) {
  return content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

async function walkFiles(dir, extensions, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full, extensions, relative)));
      continue;
    }
    if (entry.isFile() && extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
      files.push(relative);
    }
  }
  return files;
}

async function main() {
  const targetFiles = await walkFiles(RAW_DIR, [".html", ".css"]);
  let rewrittenFiles = 0;

  for (const relative of targetFiles) {
    const absolute = path.join(RAW_DIR, relative);
    let content = await readFile(absolute, "utf-8");
    content = normalizeRelativeMirrorPaths(content);
    content = dedupeOriginalsPublicPrefix(content);
    content = upgradeWixMediaUrls(content);
    content = dedupeOriginalsPublicPrefix(content);

    content = content.replace(
      /(https?:\\\/\\\/[^\s"'<>]+|https?:\/\/[^\s"'<>]+)/g,
      (match) => {
        const local = localUrlForAbsolute(match);
        return local || match;
      }
    );

    if (relative.endsWith(".html")) {
      content = normalizeWixPublicBaseUrls(content, relative);
      content = removeWixMoreMenuItem(content);
      content = injectArchiveLayoutFix(content);
      content = injectPageTextOverlay(content, relative);
      content = stripScripts(content);
      content = content.replace(
        /(href|src)=["'](?:\.\/)?blog\.html["']/gi,
        (_full, attr) => `${attr}="/blog/"`
      );
      content = content.replace(
        /(href|src)=["']\/raw\/blog\.html["']/gi,
        (_full, attr) => `${attr}="/blog/"`
      );
      content = content.replace(
        /(href|src)=["'](?:\.\/)?post\/([^"']+)\.html["']/gi,
        (_full, attr, slug) => `${attr}="/post/${slug}/"`
      );
      if (relative === "blog.html") {
        content = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Redirigiendo al blog</title><meta http-equiv="refresh" content="0; url=/blog/"><link rel="canonical" href="/blog/"></head><body><p>Redirigiendo al blog: <a href="/blog/">/blog/</a></p></body></html>`;
      }
    }

    await writeFile(absolute, content, "utf-8");
    rewrittenFiles += 1;
  }

  console.log(
    `Enlaces locales en .generated/raw (${rewrittenFiles} archivos). Imágenes Wix → ${ORIGINALS_PUBLIC_PREFIX}/ o mejor variante en ${WIXSTATIC_PUBLIC}/`
  );
}

main().catch((error) => {
  console.error("Error en link-assets-local:", error);
  process.exit(1);
});
