import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CONTENT_ROOT = path.resolve(ROOT, "../src/content/pages/post");
const RAW_SOURCE_ROOT = path.resolve(ROOT, "../www.fenicio.es");
const OUTPUT_FILE = path.resolve(ROOT, "src/data/posts.json");
const RAW_PUBLIC_DIR = path.resolve(ROOT, "public/raw");

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

function localVendorMediaUrl(urlOrUri) {
  if (!urlOrUri) return "";
  const value = decodeEntities(urlOrUri.trim());
  if (!value) return "";

  // Wix uri relative (ej: 344230_xxx.jpg)
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return `/vendor/static.wixstatic.com/media/${value}`;
  }

  let u;
  try {
    u = new URL(value);
  } catch {
    return value;
  }
  if (u.hostname !== "static.wixstatic.com") return value;

  const m = u.pathname.match(/^\/media\/([^/]+)/);
  if (!m) return value;
  return `/vendor/static.wixstatic.com/media/${m[1]}`;
}

function ensureLocalAsset(url) {
  if (!url || !url.startsWith("/")) return "";
  const absolute = path.resolve(ROOT, "public", url.replace(/^\//, ""));
  return existsSync(absolute) ? url : "";
}

function localizeRichHtmlUrls(html) {
  return html.replace(/https?:\/\/[^\s"'<>]+/g, (raw) => {
    // Mantener plataformas de video externas.
    if (
      /(?:youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|i\.ytimg\.com)/i.test(raw)
    ) {
      return raw;
    }

    // Convertir enlaces del propio dominio a rutas internas.
    try {
      const u = new URL(raw);
      if (u.hostname === "www.fenicio.es" || u.hostname === "fenicio.es") {
        if (u.pathname === "/blog" || u.pathname.startsWith("/blog/")) return `/blog/`;
        if (u.pathname.startsWith("/post/")) {
          const slug = u.pathname.replace(/^\/post\//, "").replace(/\/+$/, "");
          return `/post/${slug}/`;
        }
        return u.pathname || "/";
      }
    } catch {
      return raw;
    }

    // Convertir media de Wix a vendor local.
    if (/https?:\/\/static\.wixstatic\.com\/media\//i.test(raw)) {
      return localVendorMediaUrl(raw);
    }

    return raw;
  });
}

function titleFromHtml(html, fallback) {
  const h1Match = html.match(/data-hook="post-title"[^>]*>\s*<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const fromH1 = stripTags(h1Match[1]);
    if (fromH1) return fromH1;
  }
  const match = html.match(/<title>(.*?)<\/title>/is);
  if (!match) return fallback;
  return match[1].replace(/\s+/g, " ").replace(/\s*-\s*Fenicio.*$/i, "").trim();
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function removeStyleAndScriptBlocks(value) {
  return value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
}

function cleanExcerptText(value) {
  return value
    .replace(/#pro-gallery[^\s]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function postBodyHtml(html) {
  const section = html.match(/<section[^>]*data-hook="post-description"[^>]*>([\s\S]*?)<\/section>/i);
  const base = section ? section[1] : html;
  return localizeRichHtmlUrls(removeStyleAndScriptBlocks(base));
}

function normalizeExcerpt(excerpt, title, youtubeUrl) {
  let text = excerpt || "";
  if (!text) return "";

  const normalizedTitle = title.trim();
  if (normalizedTitle) {
    const escaped = normalizedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^${escaped}\\s*`, "i"), "");
  }

  if (youtubeUrl) {
    const escapedUrl = youtubeUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^${escapedUrl}\\s*`, "i"), "");
    // elimina repeticiones del enlace dentro del excerpt
    text = text.replace(new RegExp(escapedUrl, "gi"), "").replace(/\s+/g, " ").trim();
  }

  return text.trim();
}

function excerptFromHtml(html) {
  const descriptionBlock = html.match(/<section[^>]*data-hook="post-description"[^>]*>([\s\S]*?)<\/section>/i);
  if (descriptionBlock) {
    const fromBlock = cleanExcerptText(
      decodeEntities(stripTags(removeStyleAndScriptBlocks(descriptionBlock[1])))
    );
    if (fromBlock.length > 40) return fromBlock.slice(0, 280).trim();
  }
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => cleanExcerptText(decodeEntities(stripTags(removeStyleAndScriptBlocks(m[1])))))
    .filter((text) => text.length > 40);
  return paragraphs[0] || "";
}

function youtubeFromHtml(html) {
  const match = html.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^"'\s<]+/i);
  return match ? match[0] : "";
}

function youtubeVideoId(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.replace(/^\/+/, "").split("/")[0];
    }
    if (u.pathname.startsWith("/live/")) {
      return u.pathname.split("/")[2] || "";
    }
    if (u.pathname === "/watch") {
      return u.searchParams.get("v") || "";
    }
  } catch {
    return "";
  }
  return "";
}

function publishedFromHtml(html) {
  const titleAttr = html.match(/data-hook="time-ago"[^>]*title="([^"]+)"/i);
  if (titleAttr) return titleAttr[1].trim();
  const spanContent = html.match(/data-hook="time-ago"[^>]*>([\s\S]*?)<\/span>/i);
  if (spanContent) return stripTags(spanContent[1]);
  return "";
}

function thumbnailFromHtml(html) {
  const imageInfo = html.match(/"imageData":\{"width":\d+,"height":\d+,"uri":"([^"]+)"/i);
  if (imageInfo) {
    const local = ensureLocalAsset(localVendorMediaUrl(imageInfo[1]));
    if (local) return local;
  }
  const direct = html.match(/https?:\/\/static\.wixstatic\.com\/media\/[^"'\s<>]+/i);
  if (direct) {
    const local = ensureLocalAsset(localVendorMediaUrl(direct[0]));
    if (local) return local;
  }
  const youtubeThumb = html.match(/https?:\/\/i\.ytimg\.com\/[^"'\s<>]+?\.(?:jpg|jpeg|png|webp)/i);
  if (youtubeThumb) return youtubeThumb[0].replace(/[),.;]+$/, "");
  return "";
}

function parseSpanishDate(value) {
  if (!value) return null;
  const clean = value.toLowerCase().trim();
  const months = {
    ene: 0,
    enero: 0,
    feb: 1,
    febrero: 1,
    mar: 2,
    marzo: 2,
    abr: 3,
    abril: 3,
    may: 4,
    mayo: 4,
    jun: 5,
    junio: 5,
    jul: 6,
    julio: 6,
    ago: 7,
    agosto: 7,
    sep: 8,
    sept: 8,
    septiembre: 8,
    oct: 9,
    octubre: 9,
    nov: 10,
    noviembre: 10,
    dic: 11,
    diciembre: 11
  };

  const m = clean.match(/(\d{1,2})\s+([a-záéíóú]+)\s+(\d{4})/i);
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  const month = months[m[2]] ?? null;
  const year = Number.parseInt(m[3], 10);
  if (month === null || Number.isNaN(day) || Number.isNaN(year)) return null;
  return new Date(Date.UTC(year, month, day)).getTime();
}

async function main() {
  await rm(RAW_PUBLIC_DIR, { recursive: true, force: true });
  await mkdir(path.dirname(RAW_PUBLIC_DIR), { recursive: true });
  await cp(RAW_SOURCE_ROOT, RAW_PUBLIC_DIR, { recursive: true });

  const files = await listHtmlFiles(CONTENT_ROOT);
  const blogHtml = await readFile(path.join(RAW_SOURCE_ROOT, "blog.html"), "utf-8").catch(() => "");
  const posts = [];

  for (const file of files) {
    const relative = path.relative(CONTENT_ROOT, file).replace(/\\/g, "/");
    const slug = relative.replace(/\.html$/i, "");
    const html = await readFile(file, "utf-8");
    const title = titleFromHtml(html, slug);
    const youtubeUrl = youtubeFromHtml(html);
    const excerpt = normalizeExcerpt(excerptFromHtml(html), title, youtubeUrl);
    const parsedYoutubeId = youtubeVideoId(youtubeUrl);
    const youtubePoster = parsedYoutubeId
      ? `https://i.ytimg.com/vi/${parsedYoutubeId}/hqdefault.jpg`
      : "";
    const thumbnailUrl = thumbnailFromHtml(html) || youtubePoster;

    posts.push({
      slug,
      title,
      publishedAt: publishedFromHtml(html),
      thumbnailUrl,
      excerpt,
      youtubeUrl,
      contentHtml: postBodyHtml(html)
    });
  }

  for (const post of posts) {
    const idx = blogHtml.indexOf(`/post/${post.slug}`);
    post.sortIndex = idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
    post.publishedTs = parseSpanishDate(post.publishedAt) ?? 0;
  }

  posts.sort(
    (a, b) =>
      b.publishedTs - a.publishedTs || a.sortIndex - b.sortIndex || a.slug.localeCompare(b.slug, "es")
  );
  await writeFile(OUTPUT_FILE, JSON.stringify(posts, null, 2), "utf-8");
  console.log(`Posts importados a Astro: ${posts.length}. Mirror raw copiado a public/raw.`);
}

main().catch((error) => {
  console.error("Error importando contenido:", error);
  process.exit(1);
});
