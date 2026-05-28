import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "www.fenicio.es");
const PAGES_CONTENT_DIR = path.join(ROOT, "src", "content", "pages");
const CONTENT_FILE = path.join(ROOT, "src", "content", "routes.json");

const SOURCE_DOMAIN = "https://www.fenicio.es";
const ALT_SOURCE_DOMAIN = "https://fenicio.es";

function routeFromRelativeHtml(relativeFile) {
  const normalized = relativeFile.replace(/\\/g, "/");
  if (normalized === "index.html") return "/";
  return `/${normalized.replace(/\.html$/i, "")}`;
}

function titleFromHtml(html, fallback) {
  const titleMatch = html.match(/<title>(.*?)<\/title>/is);
  if (!titleMatch) return fallback;
  return titleMatch[1].replace(/\s+/g, " ").trim();
}

function bodyFromHtml(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return html;
  return bodyMatch[1].trim();
}

function stripWixRuntime(fragment) {
  return fragment
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/>/gi, "");
}

function canonicalizePathname(pathname) {
  if (pathname.endsWith("/index.html")) {
    const trimmed = pathname.slice(0, -"/index.html".length);
    return trimmed || "/";
  }
  if (pathname.endsWith(".html")) {
    return pathname.slice(0, -".html".length) || "/";
  }
  return pathname || "/";
}

function pickExistingRoute(pathname, routeSet) {
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    decodedPath = pathname;
  }

  pathname = decodedPath;
  if (routeSet.has(pathname)) return pathname;
  if (pathname !== "/" && routeSet.has(pathname.replace(/\/+$/, ""))) return pathname.replace(/\/+$/, "");

  if (pathname === "/post") return "/blog";

  const parts = pathname.split("/").filter(Boolean);
  const last = parts.at(-1);
  if (!last) return pathname;

  const direct = `/${last}`;
  if (routeSet.has(direct)) return direct;

  const post = `/post/${last}`;
  if (routeSet.has(post)) return post;

  return pathname;
}

function normalizeAttrUrl(rawUrl, sourceRoute, routeSet) {
  const value = rawUrl.trim();
  if (!value) return value;
  if (value === "true" || value === "false") return value;
  if (value.startsWith("#")) return value;
  if (value.startsWith("mailto:") || value.startsWith("tel:") || value.startsWith("javascript:")) return value;

  const sourceBase = `https://local${sourceRoute.endsWith("/") ? sourceRoute : `${sourceRoute}/`}`;

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("//")) {
    const normalizedAbsolute = value
      .replace(/^\/\//, "https://")
      .replace(ALT_SOURCE_DOMAIN, SOURCE_DOMAIN);
    if (!normalizedAbsolute.startsWith(SOURCE_DOMAIN)) {
      return value;
    }
    const url = new URL(normalizedAbsolute);
    const canonical = pickExistingRoute(canonicalizePathname(url.pathname), routeSet);
    return `${canonical}${url.search}${url.hash}`;
  }

  // Links like "equipo.html" or "post/foo.html" are intended from site root.
  if (!value.startsWith("/") && !value.startsWith("./") && !value.startsWith("../") && value.includes(".html")) {
    const clean = value.split("?")[0].split("#")[0];
    const query = value.includes("?") ? `?${value.split("?")[1]}` : "";
    const hash = value.includes("#") ? `#${value.split("#")[1]}` : "";
    const canonical = pickExistingRoute(canonicalizePathname(`/${clean}`), routeSet);
    return `${canonical}${query}${hash}`;
  }

  const resolved = new URL(value, sourceBase);
  const canonical = pickExistingRoute(canonicalizePathname(resolved.pathname), routeSet);
  return `${canonical}${resolved.search}${resolved.hash}`;
}

function normalizeLinks(fragment, sourceRoute, routeSet) {
  const sanitized = stripWixRuntime(fragment)
    .replaceAll(`${SOURCE_DOMAIN}/`, "/")
    .replaceAll(`${SOURCE_DOMAIN}`, "/")
    .replaceAll(`${ALT_SOURCE_DOMAIN}/`, "/")
    .replaceAll(`${ALT_SOURCE_DOMAIN}`, "/");

  return sanitized.replace(/(href|src)=["']([^"']+)["']/gi, (full, attr, url) => {
    const normalized = normalizeAttrUrl(url, sourceRoute, routeSet);
    return `${attr}="${normalized}"`;
  });
}

async function walkHtmlFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkHtmlFiles(fullPath, relative)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(relative);
    }
  }

  return files;
}

async function main() {
  await rm(path.join(ROOT, "src", "generated"), { recursive: true, force: true });
  await rm(PAGES_CONTENT_DIR, { recursive: true, force: true });
  await mkdir(PAGES_CONTENT_DIR, { recursive: true });

  const htmlFiles = await walkHtmlFiles(SOURCE_DIR);
  const routeSet = new Set(htmlFiles.map((relative) => routeFromRelativeHtml(relative)));
  const routes = [];

  for (const relative of htmlFiles.sort()) {
    const absolute = path.join(SOURCE_DIR, relative);
    const html = await readFile(absolute, "utf-8");
    const route = routeFromRelativeHtml(relative);
    const title = titleFromHtml(html, route);
    const body = normalizeLinks(bodyFromHtml(html), route, routeSet);

    const contentFileName = relative;
    const contentFile = path.join(PAGES_CONTENT_DIR, contentFileName);

    await mkdir(path.dirname(contentFile), { recursive: true });
    await writeFile(contentFile, body, "utf-8");

    routes.push({
      route,
      title,
      sourceHtml: relative,
      pageContent: path.relative(path.join(ROOT, "src"), contentFile).replace(/\\/g, "/")
    });
  }

  await writeFile(CONTENT_FILE, JSON.stringify(routes, null, 2), "utf-8");
  console.log(`Adaptacion completada. Rutas generadas: ${routes.length}`);
}

main().catch((error) => {
  console.error("Error en adaptacion:", error);
  process.exit(1);
});
