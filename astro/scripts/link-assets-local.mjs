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
.fenicio-nav-toggle{
  position:absolute!important;
  width:1px!important;
  height:1px!important;
  padding:0!important;
  margin:-1px!important;
  overflow:hidden!important;
  clip:rect(0,0,0,0)!important;
  white-space:nowrap!important;
  border:0!important;
}
.fenicio-nav-btn{display:none}
/* Móvil/tablet: ancho fluido, menú hamburguesa y texto adaptable */
@media (max-width:999px){
html,body{overflow-x:hidden;max-width:100%}
#SITE_CONTAINER,#main_MF,#site-root,#masterPage{width:100%!important;min-width:0!important;max-width:100vw}
#SITE_HEADER{
  position:sticky!important;
  top:0;
  z-index:200;
  width:100%!important;
  background:#fff!important;
}
#SITE_HEADER .YmWgf4,#SITE_HEADER .XgJ1FR{width:100%!important;max-width:100%!important}
#SITE_HEADER [data-mesh-id="SITE_HEADERinlineContent-gridContainer"]{
  display:flex!important;
  flex-direction:column!important;
  align-items:stretch!important;
  position:relative!important;
  padding:10px 56px 6px 12px!important;
  box-sizing:border-box;
  width:100%!important;
  min-height:52px;
}
[data-mesh-id=SITE_HEADERinlineContent-gridContainer]>[id="comp-l2pwao3j"],
[data-mesh-id=SITE_HEADERinlineContent-gridContainer]>interact-element>[id="comp-l2pwao3j"],
[data-mesh-id=SITE_HEADERinlineContent-gridContainer]>[id="comp-ju1005uj"],
[data-mesh-id=SITE_HEADERinlineContent-gridContainer]>interact-element>[id="comp-ju1005uj"]{
  position:relative!important;
  left:0!important;
  margin:0!important;
  width:100%!important;
  max-width:100%!important;
  grid-area:unset!important;
  justify-self:stretch!important;
}
#comp-l2pwao3j{width:100%!important;max-width:100%!important;text-align:center;order:1!important}
.fenicio-mobile-nav{order:2!important}
#comp-l2pwao3j h2,#comp-l2pwao3j .font_2{font-size:clamp(26px,7vw,38px)!important;line-height:1.15!important}
.fenicio-nav-btn{
  display:flex!important;
  flex-direction:column;
  justify-content:center;
  gap:5px;
  position:fixed;
  top:10px;
  right:10px;
  width:44px;
  height:44px;
  padding:10px;
  border:1px solid rgba(139,0,0,.35);
  border-radius:6px;
  background:#fff;
  cursor:pointer;
  box-sizing:border-box;
  z-index:100001;
  box-shadow:0 2px 8px rgba(0,0,0,.12);
}
.fenicio-nav-btn span{
  display:block;
  height:2px;
  width:100%;
  background:#8b0000;
  border-radius:1px;
  transition:transform .2s ease,opacity .2s ease;
}
#comp-ju1005uj,wix-dropdown-menu#comp-ju1005uj{display:none!important}
.fenicio-mobile-nav{
  display:none;
  flex-direction:column;
  align-items:stretch;
  gap:0;
  margin:0;
  padding:6px 0 10px;
  list-style:none;
  border-top:1px solid rgba(139,0,0,.15);
  background:#fff;
  width:100%;
  box-sizing:border-box;
}
.fenicio-mobile-nav a{
  display:block;
  padding:12px 8px;
  color:#8b0000!important;
  text-decoration:none!important;
  font-size:16px;
  line-height:1.35;
  text-align:center;
  border-top:1px solid rgba(139,0,0,.1);
}
.fenicio-mobile-nav a:first-child{border-top:0}
.fenicio-mobile-nav a:hover{background:rgba(248,244,241,.9)}
#fenicio-nav-toggle:checked~.fenicio-mobile-nav,
.fenicio-mobile-nav.fenicio-nav-open{display:flex!important}
#fenicio-nav-toggle:checked+.fenicio-nav-btn span:nth-child(1){transform:translateY(7px) rotate(45deg)}
#fenicio-nav-toggle:checked+.fenicio-nav-btn span:nth-child(2){opacity:0}
#fenicio-nav-toggle:checked+.fenicio-nav-btn span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
#comp-lm3cvp8r,#comp-ljgz0u32{min-width:0!important;width:100%!important;max-width:100%!important;margin:0!important;left:0!important}
[data-mesh-id*="inlineContent-gridContainer"]>[id^="comp-"],
[data-mesh-id*="inlineContent-gridContainer"]>interact-element>[id^="comp-"],
[data-mesh-id$="inlineContent-gridContainer"]>[id^="comp-"],
[data-mesh-id$="inlineContent-gridContainer"]>interact-element>[id^="comp-"]{
  position:relative!important;
  left:0!important;
  top:auto!important;
  margin:0!important;
  width:100%!important;
  max-width:100%!important;
  box-sizing:border-box!important;
  grid-area:unset!important;
}
#comp-lm3cvpdf,#comp-jv4wb48x,.wixui-rich-text[data-testid="richTextElement"]{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  box-sizing:border-box!important;
}
#comp-lm3cvp8r img,#comp-ljgz0u32 img,.bgImage img{width:100%!important;height:auto!important;max-width:100%!important;object-fit:cover}
[data-mesh-id="comp-lm3cvp8rinlineContent"],[data-mesh-id="comp-ljgz0u32inlineContent"]{width:100%!important;max-width:100%!important;box-sizing:border-box!important}
[data-mesh-id="comp-lm3cvp8rinlineContent"] p,[data-mesh-id="comp-ljgz0u32inlineContent"] p,
[data-mesh-id="comp-lm3cvp8rinlineContent"] .font_8,[data-mesh-id="comp-ljgz0u32inlineContent"] .font_8,
[data-mesh-id="comp-lm3cvp8rinlineContent"] .wixui-rich-text__text,[data-mesh-id="comp-ljgz0u32inlineContent"] .wixui-rich-text__text{
  font-size:clamp(15px,4.2vw,24px)!important;
  line-height:1.45!important;
  max-width:100%!important;
  overflow-wrap:break-word!important;
  word-wrap:break-word!important;
}
[data-mesh-id="comp-lm3cvp8rinlineContent"] span[style*="font-size"],[data-mesh-id="comp-ljgz0u32inlineContent"] span[style*="font-size"]{font-size:inherit!important}
[data-mesh-id="comp-ljgz0u32inlineContent-gridContainer"]{margin-bottom:0!important}
#comp-ljgz0u32,[data-mesh-id="comp-ljgz0u32inlineContent"]{padding-bottom:2.5rem!important}
#comp-lm3cvp8r,[data-mesh-id="comp-lm3cvp8rinlineContent"]{padding-bottom:2rem!important}
#PAGES_CONTAINER,#SITE_PAGES{padding-bottom:2rem!important}
}
@media (min-width:1000px){
.fenicio-mobile-nav{display:none!important}
#comp-ju1005uj,wix-dropdown-menu#comp-ju1005uj{display:block!important}
}
</style>`;

const ARCHIVE_NAV_HEAD = `<input type="checkbox" id="fenicio-nav-toggle" class="fenicio-nav-toggle" tabindex="-1" aria-hidden="true">
<label for="fenicio-nav-toggle" class="fenicio-nav-btn" aria-label="Menú de navegación" aria-expanded="false"><span></span><span></span><span></span></label>`;

const ARCHIVE_NAV_MENU = `<nav id="fenicio-mobile-nav" class="fenicio-mobile-nav" aria-label="Navegación móvil">
<a href="/">El Proyecto</a>
<a href="/equipo.html">El Equipazo</a>
<a href="/embarcación.html">La Máquina</a>
<a href="/blog/">El Libro de Bitácora</a>
</nav>`;

const FENICIO_NAV_SCRIPT = `<script data-fenicio-keep>(()=>{const t=document.getElementById("fenicio-nav-toggle");const n=document.getElementById("fenicio-mobile-nav");const b=document.querySelector(".fenicio-nav-btn");if(!t||!n)return;const sync=()=>{const on=!!t.checked;n.classList.toggle("fenicio-nav-open",on);b?.setAttribute("aria-expanded",on?"true":"false")};t.addEventListener("change",sync);n.querySelectorAll("a").forEach((a)=>a.addEventListener("click",()=>{t.checked=false;sync()}));sync();})();</script>`;

/** Quita el ítem "More" del dropdown Wix en HTML. */
function removeWixMoreMenuItem(content) {
  return content.replace(/<li\b[^>]*\bid="[^"]*__more__"[^>]*>[\s\S]*?<\/li>/gi, "");
}

function injectArchiveLayoutFix(content) {
  if (content.includes('id="fenicio-archive-layout"')) {
    return content.replace(
      /<style id="fenicio-archive-layout">[\s\S]*?<\/style>/i,
      ARCHIVE_LAYOUT_FIX.trim(),
    );
  }
  if (/<\/head>/i.test(content)) {
    return content.replace(/<\/head>/i, `${ARCHIVE_LAYOUT_FIX}</head>`);
  }
  return `${ARCHIVE_LAYOUT_FIX}${content}`;
}

/** Toggle menú móvil en cabecera Wix (título arriba, enlaces debajo, como Wix). */
function injectArchiveNavToggle(content) {
  if (!content.includes('id="SITE_HEADER"')) return content;

  content = content.replace(
    /<div id="SITE_CONTAINER">\s*<input[^>]*id="fenicio-nav-toggle"[^>]*>\s*<label[^>]*class="fenicio-nav-btn"[^>]*>[\s\S]*?<\/label>\s*/i,
    "<div id=\"SITE_CONTAINER\">",
  );
  content = content.replace(/<nav id="fenicio-mobile-nav"[\s\S]*?<\/nav>\s*/gi, "");
  content = content.replace(
    /<input[^>]*id="fenicio-nav-toggle"[^>]*>\s*<label[^>]*class="fenicio-nav-btn"[^>]*>[\s\S]*?<\/label>\s*/gi,
    "",
  );

  if (content.includes('id="fenicio-nav-toggle"')) return content;

  let updated = content.replace(
    /<div data-mesh-id="SITE_HEADERinlineContent-gridContainer"[^>]*>/i,
    (match) => `${match}${ARCHIVE_NAV_HEAD}`,
  );

  updated = updated.replace(
    /(<div id="comp-l2pwao3j"[\s\S]*?<\/div>)<!--\/\$-->\s*<!--\$-->\s*<wix-dropdown-menu id="comp-ju1005uj"/i,
    `$1<!--/$-->${ARCHIVE_NAV_MENU}<!--$--><wix-dropdown-menu id="comp-ju1005uj"`,
  );

  return updated;
}

function injectArchiveNavScript(content) {
  if (!content.includes('id="fenicio-nav-toggle"')) return content;
  content = content.replace(/<script\b[^>]*data-fenicio-keep[^>]*>[\s\S]*?<\/script>/gi, "");
  if (/<\/body>/i.test(content)) {
    return content.replace(/<\/body>/i, `${FENICIO_NAV_SCRIPT}</body>`);
  }
  return `${content}${FENICIO_NAV_SCRIPT}`;
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
  padding:1.25rem 1.75rem 2.75rem!important;
  box-sizing:border-box;
}
@media (max-width:999px){
[data-mesh-id="${meshId}"]{padding:1rem 4vw 3.25rem!important;width:100%!important;max-width:100%!important}
}
</style>`;

  if (content.includes('id="fenicio-text-overlay"')) {
    return content.replace(/<style id="fenicio-text-overlay">[\s\S]*?<\/style>/i, overlayStyle.trim());
  }
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
  return content.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, (match, attrs) =>
    /data-fenicio-keep/i.test(attrs) ? match : "",
  );
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
      content = injectArchiveNavToggle(content);
      content = injectPageTextOverlay(content, relative);
      content = stripScripts(content);
      content = injectArchiveNavScript(content);
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
