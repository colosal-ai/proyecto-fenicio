import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const RAW_SOURCE_DIR = path.join(ROOT, "www.fenicio.es");
const ALT_SOURCE_DIR = path.join(ROOT, "fenicio.es");

const SOURCE_DOMAIN = "https://www.fenicio.es";
const ALT_SOURCE_DOMAIN = "https://fenicio.es";

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

function localizeDomains(html) {
  return html
    .replaceAll(`${SOURCE_DOMAIN}/`, "/")
    .replaceAll(`${SOURCE_DOMAIN}`, "/")
    .replaceAll(`${ALT_SOURCE_DOMAIN}/`, "/")
    .replaceAll(`${ALT_SOURCE_DOMAIN}`, "/");
}

function extractTitle(html, fallback) {
  const match = html.match(/<title>(.*?)<\/title>/is);
  if (!match) return fallback;
  return match[1].replace(/\s+/g, " ").trim();
}

function decodePostSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

async function buildPostsIndex() {
  const postDir = path.join(DIST_DIR, "post");
  const postFiles = await walkHtmlFiles(postDir);

  const posts = [];
  for (const relative of postFiles) {
    const slug = relative.replace(/\.html$/i, "").replace(/\\/g, "/");
    const html = await readFile(path.join(postDir, relative), "utf-8");
    const title = extractTitle(html, decodePostSlug(slug));
    posts.push({ slug, title });
  }

  posts.sort((a, b) => a.title.localeCompare(b.title, "es"));

  const listItems = posts
    .map((post) => `<li><a href="/post/${post.slug}.html">${post.title}</a></li>`)
    .join("\n");

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Blog - Todos los articulos</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      h1 { margin-bottom: 8px; }
      p { color: #555; }
      ul { line-height: 1.7; }
      a { color: #0b5cff; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <h1>Blog - Todos los articulos</h1>
    <p>Total: ${posts.length}</p>
    <ul>
      ${listItems}
    </ul>
  </body>
</html>`;

  await writeFile(path.join(DIST_DIR, "blog.html"), html, "utf-8");
  await writeFile(path.join(DIST_DIR, "posts.html"), html, "utf-8");
  await mkdir(path.join(DIST_DIR, "blog"), { recursive: true });
  await mkdir(path.join(DIST_DIR, "posts"), { recursive: true });
  await writeFile(path.join(DIST_DIR, "blog", "index.html"), html, "utf-8");
  await writeFile(path.join(DIST_DIR, "posts", "index.html"), html, "utf-8");
}

async function main() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await cp(RAW_SOURCE_DIR, DIST_DIR, { recursive: true });

  // Fallback por si la home se hubiera descargado en fenicio.es/index.html
  try {
    const altHome = await readFile(path.join(ALT_SOURCE_DIR, "index.html"), "utf-8");
    await writeFile(path.join(DIST_DIR, "index-alt.html"), localizeDomains(altHome), "utf-8");
  } catch {
    // no-op
  }

  const htmlFiles = await walkHtmlFiles(DIST_DIR);
  for (const relative of htmlFiles) {
    const absolute = path.join(DIST_DIR, relative);
    const html = await readFile(absolute, "utf-8");
    await writeFile(absolute, localizeDomains(html), "utf-8");
  }

  await buildPostsIndex();

  console.log(`Build fidelidad generado en dist/. Paginas: ${htmlFiles.length}`);
}

main().catch((error) => {
  console.error("Error en build:", error);
  process.exit(1);
});
