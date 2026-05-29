/**
 * Reescribe public/raw desde assets ya presentes en el repo (sin red).
 * Sustituye a vendorize-raw.mjs (deprecado).
 */
import { existsSync, statSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const REPO_ROOT = path.resolve(ROOT, "..");
const RAW_DIR = path.join(ROOT, "public", "raw");
const ORIGINALS_DIR = path.join(ROOT, "public", "originals/static.wixstatic.com/media");
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
    return `/raw${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

function wixAssetIdFromPath(pathname) {
  const m = pathname.match(/(344230_[A-Za-z0-9_.~-]+\.(?:jpg|jpeg|png|webp))/i);
  return m ? m[1] : "";
}

function findMirrorWixPath(assetId, pathname) {
  if (!assetId) return "";
  const original = path.join(ORIGINALS_DIR, assetId);
  if (existsSync(original)) {
    return `/originals/static.wixstatic.com/media/${assetId}`;
  }
  const relFromUrl = pathname.replace(/^\/+/, "");
  const exact = path.join(REPO_ROOT, "static.wixstatic.com", relFromUrl);
  if (existsSync(exact)) {
    return `${WIXSTATIC_PUBLIC}/${relFromUrl}`;
  }
  const mediaDir = path.join(REPO_ROOT, "static.wixstatic.com/media", assetId);
  if (!existsSync(mediaDir)) return "";
  try {
    const st = statSync(mediaDir);
    if (st.isFile()) return `${WIXSTATIC_PUBLIC}/media/${assetId}`;
  } catch {
    return "";
  }
  return `${WIXSTATIC_PUBLIC}/media/${assetId}`;
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
    .replace(/(?:\.\.\/)+static\.wixstatic\.com\//g, `${WIXSTATIC_PUBLIC}/`);
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

    content = content.replace(
      /(https?:\\\/\\\/[^\s"'<>]+|https?:\/\/[^\s"'<>]+)/g,
      (match) => {
        const local = localUrlForAbsolute(match);
        return local || match;
      }
    );

    if (relative.endsWith(".html")) {
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
        content = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Redirigiendo al blog completo</title><meta http-equiv="refresh" content="0; url=/blog/todos/"><link rel="canonical" href="/blog/todos/"></head><body><p>Redirigiendo al listado completo: <a href="/blog/todos/">/blog/todos/</a></p></body></html>`;
      }
    }

    await writeFile(absolute, content, "utf-8");
    rewrittenFiles += 1;
  }

  console.log(
    `Enlaces locales aplicados (sin red). Archivos: ${rewrittenFiles}. Assets: ${PARASTORAGE_PUBLIC}, ${WIXSTATIC_PUBLIC}, /originals/…`
  );
}

main().catch((error) => {
  console.error("Error en link-assets-local:", error);
  process.exit(1);
});
