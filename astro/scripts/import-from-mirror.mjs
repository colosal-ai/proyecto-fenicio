import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CONTENT_ROOT = path.resolve(ROOT, "../src/content/pages/post");
const OUTPUT_FILE = path.resolve(ROOT, "src/data/posts.json");

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listHtmlFiles(full)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

function titleFromHtml(html, fallback) {
  const match = html.match(/<title>(.*?)<\/title>/is);
  if (!match) return fallback;
  return match[1].replace(/\s+/g, " ").trim();
}

async function main() {
  const files = await listHtmlFiles(CONTENT_ROOT);
  const posts = [];

  for (const file of files) {
    const relative = path.relative(CONTENT_ROOT, file).replace(/\\/g, "/");
    const slug = relative.replace(/\.html$/i, "");
    const html = await readFile(file, "utf-8");
    posts.push({
      slug,
      title: titleFromHtml(html, slug),
      contentHtml: html
    });
  }

  posts.sort((a, b) => a.slug.localeCompare(b.slug, "es"));
  await writeFile(OUTPUT_FILE, JSON.stringify(posts, null, 2), "utf-8");
  console.log(`Posts importados a Astro: ${posts.length}`);
}

main().catch((error) => {
  console.error("Error importando contenido:", error);
  process.exit(1);
});
