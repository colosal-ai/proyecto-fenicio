import { cp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

  console.log(`Build fidelidad generado en dist/. Paginas: ${htmlFiles.length}`);
}

main().catch((error) => {
  console.error("Error en build:", error);
  process.exit(1);
});
