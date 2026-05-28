import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "public", "raw");
const VENDOR_DIR = path.join(ROOT, "public", "vendor");
const SELF_HOSTS = new Set(["www.fenicio.es", "fenicio.es"]);
const SKIP_HOSTS = new Set(["www.w3.org"]);
const KEEP_EXTERNAL_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "player.vimeo.com",
  "vimeo.com"
]);

function toUrl(value) {
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return null;
}

function unescapeSlashes(value) {
  return value.replaceAll("\\/", "/");
}

function toOriginalWixMedia(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    return urlString;
  }

  if (u.hostname !== "static.wixstatic.com") return urlString;
  if (!u.pathname.startsWith("/media/")) return urlString;

  // Convierte variantes /media/<file>/v1/fill/.../<file> a /media/<file> (original).
  // Ejemplo:
  // /media/abc.jpg/v1/fill/w_300,h_200/.../abc.jpg -> /media/abc.jpg
  const match = u.pathname.match(/^\/media\/([^/]+)\/v1\/.*$/);
  if (!match) return urlString;

  u.pathname = `/media/${match[1]}`;
  u.search = "";
  u.hash = "";
  return u.toString();
}

function hashText(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function vendorPathFromUrl(urlString) {
  const u = new URL(urlString);
  const pathname = u.pathname === "/" ? "/index" : u.pathname;
  const safePath = pathname.replace(/\/+$/, "") || "/index";
  const ext = path.extname(safePath);
  const querySuffix = u.search ? `__${hashText(u.search)}` : "";
  const finalWithQuery = ext
    ? `${safePath.slice(0, -ext.length)}${querySuffix}${ext}`
    : `${safePath}${querySuffix}.bin`;
  const rel = path.posix.join("/vendor", u.hostname, finalWithQuery).replace(/\\/g, "/");
  const abs = path.join(ROOT, "public", rel.replace(/^\//, ""));
  return { rel, abs };
}

function rewriteSameHost(urlString) {
  const u = new URL(urlString);
  if (!SELF_HOSTS.has(u.hostname)) return null;
  if (u.pathname === "/blog" || u.pathname.startsWith("/blog/")) {
    return `${u.pathname}${u.search}${u.hash}`;
  }
  if (u.pathname.startsWith("/post/")) {
    const clean = u.pathname.replace(/\/+$/, "");
    return `${clean}/${u.search}${u.hash}`.replace("/?", "?").replace("/#", "#");
  }
  return `/raw${u.pathname}${u.search}${u.hash}`;
}

function shouldKeepExternal(urlString) {
  const u = new URL(urlString);
  return KEEP_EXTERNAL_HOSTS.has(u.hostname);
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

function collectUrlsFromContent(content) {
  const urls = new Set();
  const attrRegex = /(?:href|src)=["']([^"']+)["']/gi;
  const cssUrlRegex = /url\((['"]?)(.*?)\1\)/gi;

  let match;
  while ((match = attrRegex.exec(content)) !== null) {
    const value = match[1].trim();
    const parsed = toUrl(value);
    if (parsed) urls.add(parsed);
  }
  while ((match = cssUrlRegex.exec(content)) !== null) {
    const value = match[2].trim();
    const parsed = toUrl(value);
    if (parsed) urls.add(parsed);
  }
  return urls;
}

function stripRuntimeScripts(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/>/gi, "");
}

function rewriteContent(content, mapping) {
  let rewritten = content;
  for (const [from, to] of mapping.entries()) {
    rewritten = rewritten.split(from).join(to);
    rewritten = rewritten.split(from.replaceAll("/", "\\/")).join(to.replaceAll("/", "\\/"));
  }
  return rewritten;
}

function convertAbsoluteUrl(urlLike) {
  const normalized = toOriginalWixMedia(unescapeSlashes(urlLike));
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }

  if (KEEP_EXTERNAL_HOSTS.has(parsed.hostname)) {
    return normalized;
  }

  if (SKIP_HOSTS.has(parsed.hostname)) return null;

  const sameHost = rewriteSameHost(normalized);
  if (sameHost) return sameHost;

  const { rel } = vendorPathFromUrl(normalized);
  return rel;
}

async function downloadAsset(urlString, absPath) {
  const response = await fetch(urlString, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; FenicioAstroMigrator/1.0)"
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al descargar ${urlString}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);
}

async function main() {
  await rm(VENDOR_DIR, { recursive: true, force: true });

  const targetFiles = await walkFiles(RAW_DIR, [".html", ".css"]);
  const rawContent = new Map();
  const externalUrls = new Set();

  for (const relative of targetFiles) {
    const absolute = path.join(RAW_DIR, relative);
    let content = await readFile(absolute, "utf-8");
    if (relative.toLowerCase().endsWith(".html")) {
      content = stripRuntimeScripts(content);
    }
    rawContent.set(relative, content);
    for (const url of collectUrlsFromContent(content)) externalUrls.add(url);
  }

  const rewriteMap = new Map();
  let downloaded = 0;
  let failed = 0;

  for (const url of externalUrls) {
    const normalizedUrl = toOriginalWixMedia(unescapeSlashes(url));
    const sameHost = rewriteSameHost(normalizedUrl);
    if (sameHost) {
      rewriteMap.set(url, sameHost);
      rewriteMap.set(normalizedUrl, sameHost);
      continue;
    }
    if (shouldKeepExternal(normalizedUrl)) {
      continue;
    }
    const host = new URL(normalizedUrl).hostname;
    if (SKIP_HOSTS.has(host)) {
      continue;
    }
    const { rel, abs } = vendorPathFromUrl(normalizedUrl);
    try {
      await downloadAsset(normalizedUrl, abs);
      rewriteMap.set(url, rel);
      rewriteMap.set(unescapeSlashes(url), rel);
      rewriteMap.set(normalizedUrl, rel);
      downloaded += 1;
    } catch {
      // Si no se puede descargar, dejamos la URL original.
      failed += 1;
    }
  }

  for (const [relative, content] of rawContent.entries()) {
    const absolute = path.join(RAW_DIR, relative);
    let rewritten = rewriteContent(content, rewriteMap);

    // Segunda pasada: captura URLs absolutas embebidas/escapadas no detectadas en regex simple.
    rewritten = rewritten.replace(
      /(https?:\\\/\\\/[^\s"'<>]+|https?:\/\/[^\s"'<>]+)/g,
      (match) => {
        const normalized = unescapeSlashes(match);
        const direct = rewriteMap.get(match) || rewriteMap.get(normalized) || convertAbsoluteUrl(match);
        if (direct) return direct;
        return match;
      }
    );

    // Tercera pasada: normaliza explícitamente URLs Wix de imágenes transformadas (/v1/fill/...).
    rewritten = rewritten.replace(
      /(https?:\\\/\\\/static\.wixstatic\.com\\\/media\\\/[^\s"'<>]+|https?:\/\/static\.wixstatic\.com\/media\/[^\s"'<>]+)/g,
      (match) => {
        const local = convertAbsoluteUrl(match);
        return local || match;
      }
    );

    // Cuarta pasada: si ya se reescribio a /vendor/.../media/<file>/v1/... forzamos original local.
    rewritten = rewritten.replace(
      /\/vendor\/static\.wixstatic\.com\/media\/([^/"'\s<>]+)\/v1\/[^"'\s<>]*/g,
      (_full, fileName) => `/vendor/static.wixstatic.com/media/${fileName}`
    );

    // Quinta pasada: enruta blog y posts a las rutas Astro (paginadas).
    rewritten = rewritten.replace(
      /(href|src)=["'](?:\.\/)?blog\.html["']/gi,
      (_full, attr) => `${attr}="/blog/"`
    );
    rewritten = rewritten.replace(
      /(href|src)=["']\/raw\/blog\.html["']/gi,
      (_full, attr) => `${attr}="/blog/"`
    );
    rewritten = rewritten.replace(
      /(href|src)=["'](?:\.\/)?post\/([^"']+)\.html["']/gi,
      (_full, attr, slug) => `${attr}="/post/${slug}/"`
    );

    await writeFile(absolute, rewritten, "utf-8");
  }

  console.log(
    `Vendorización completada. Archivos procesados: ${targetFiles.length}. URLs externas detectadas: ${externalUrls.size}. Descargadas: ${downloaded}. Fallidas: ${failed}.`
  );
}

main().catch((error) => {
  console.error("Error en vendorización:", error);
  process.exit(1);
});
