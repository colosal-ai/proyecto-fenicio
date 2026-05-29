import { existsSync, statSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CONTENT_ROOT = path.resolve(ROOT, "../src/content/pages/post");
const RAW_SOURCE_ROOT = path.resolve(ROOT, "../www.fenicio.es");
const OUTPUT_FILE = path.resolve(ROOT, "src/data/posts.json");
const RAW_PUBLIC_DIR = path.resolve(ROOT, "public/raw");
const REPO_ROOT = path.resolve(ROOT, "..");
const ORIGINALS_SOURCE_DIR = path.resolve(REPO_ROOT, "originals/static.wixstatic.com/media");
const ORIGINALS_PUBLIC_DIR = path.resolve(ROOT, "public/originals/static.wixstatic.com/media");
const MIRROR_PARASTORAGE_SRC = path.resolve(REPO_ROOT, "static.parastorage.com");
const MIRROR_WIXSTATIC_SRC = path.resolve(REPO_ROOT, "static.wixstatic.com");
const MIRROR_PARASTORAGE_PUBLIC = path.resolve(ROOT, "public/static.parastorage.com");
const MIRROR_WIXSTATIC_PUBLIC = path.resolve(ROOT, "public/static.wixstatic.com");
const THUMBNAIL_OVERRIDES = {
  "tabarca-vela-en-directo-3-jornada":
    "344230_b90647a1dcb3472aaa7f62be57d52e3a~mv2.jpg"
};

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

function localMirrorWixMediaUrl(assetId) {
  if (!assetId) return "";
  const originalAbs = path.join(ORIGINALS_PUBLIC_DIR, assetId);
  if (existsSync(originalAbs)) {
    return `/originals/static.wixstatic.com/media/${assetId}`;
  }
  const mirrorFile = path.join(MIRROR_WIXSTATIC_SRC, "media", assetId);
  if (existsSync(mirrorFile)) {
    return `/static.wixstatic.com/media/${assetId}`;
  }
  const mirrorDir = mirrorFile;
  if (existsSync(mirrorDir) && statSync(mirrorDir).isDirectory()) {
    return `/static.wixstatic.com/media/${assetId}`;
  }
  return "";
}

function localMediaUrlFromCandidate(urlOrUri) {
  if (!urlOrUri) return "";
  const value = decodeEntities(urlOrUri.trim());
  if (!value) return "";

  const assetId = wixAssetIdFromText(value);
  if (assetId) {
    const local = localMirrorWixMediaUrl(assetId);
    if (local) return local;
  }

  if (/^https?:\/\/i\.ytimg\.com\//i.test(value)) return value;

  return "";
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

    if (/https?:\/\/static\.wixstatic\.com\/media\//i.test(raw)) {
      const local = localMediaUrlFromCandidate(raw);
      if (local) return local;
    }

    return raw;
  });
}

function titleFromHtml(html, fallback) {
  const h1Match = html.match(/data-hook="post-title"[^>]*>\s*<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const fromH1 = decodeEntities(stripTags(h1Match[1]));
    if (fromH1) return fromH1;
  }
  const match = html.match(/<title>(.*?)<\/title>/is);
  if (!match) return fallback;
  return decodeEntities(match[1])
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*Fenicio.*$/i, "")
    .trim();
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

function postDescriptionHtml(html) {
  const section = html.match(/<section[^>]*data-hook="post-description"[^>]*>([\s\S]*?)<\/section>/i);
  return section ? section[1] : "";
}

function wixAssetIdFromText(value = "") {
  const m = value.match(/(344230_[A-Za-z0-9_.~-]+\.(?:jpg|jpeg|png|webp))/i);
  return m ? m[1] : "";
}

function localBackupThumbnailUrl(slug, assetId) {
  if (!slug || !assetId) return "";
  const rel = `/backup/post/${encodeURIComponent(slug)}/maxres/${assetId}`;
  const abs = path.resolve(ROOT, "public", rel.replace(/^\//, ""));
  return existsSync(abs) ? rel : "";
}

function localOriginalMediaUrl(assetId) {
  if (!assetId) return "";
  const rel = `/originals/static.wixstatic.com/media/${assetId}`;
  const abs = path.join(ORIGINALS_PUBLIC_DIR, assetId);
  return existsSync(abs) ? rel : "";
}

function resolveThumbnailUrl(slug, thumbnailCandidate, contentHtml) {
  const assetId =
    wixAssetIdFromText(thumbnailCandidate) ||
    wixAssetIdFromText(contentHtml) ||
    "";

  const localBackup = localBackupThumbnailUrl(slug, assetId);
  if (localBackup) return localBackup;

  if (assetId) {
    const original = localOriginalMediaUrl(assetId);
    if (original) return original;
    const mirror = localMirrorWixMediaUrl(assetId);
    if (mirror) return mirror;
  }

  if (thumbnailCandidate) {
    if (/^https?:\/\/i\.ytimg\.com\//i.test(thumbnailCandidate)) return thumbnailCandidate;
    const fromCandidate = localMediaUrlFromCandidate(thumbnailCandidate);
    if (fromCandidate) return fromCandidate;
  }

  return "";
}

function postBodyHtml(html) {
  const base = postDescriptionHtml(html) || html;
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
  const section = postDescriptionHtml(html);
  if (section) {
    const fromBlock = cleanExcerptText(
      decodeEntities(stripTags(removeStyleAndScriptBlocks(section)))
    );
    if (fromBlock.length > 40) return fromBlock.slice(0, 280).trim();
  }
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => cleanExcerptText(decodeEntities(stripTags(removeStyleAndScriptBlocks(m[1])))))
    .filter((text) => text.length > 40);
  return paragraphs[0] || "";
}

function youtubeFromHtml(html) {
  const source = postDescriptionHtml(html) || html;
  const match = source.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^"'\s<]+/i);
  if (match) return match[0];

  const ogImage = html.match(
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']https?:\/\/i\.ytimg\.com\/vi\/([^/"']+)\/[^"']+["']/i
  );
  if (ogImage?.[1]) {
    return `https://www.youtube.com/watch?v=${ogImage[1]}`;
  }

  const youtubeThumb = html.match(/https?:\/\/i\.ytimg\.com\/vi\/([^/"']+)\/[^"'\s<]+/i);
  if (youtubeThumb?.[1]) {
    return `https://www.youtube.com/watch?v=${youtubeThumb[1]}`;
  }

  return "";
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

function youtubePosterFromUrl(url) {
  const id = youtubeVideoId(url);
  if (!id) return "";
  if (url.includes("/live/")) {
    return `https://i.ytimg.com/vi/${id}/maxresdefault_live.jpg`;
  }
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

function publishedFromHtml(html) {
  const titleAttr = html.match(/data-hook="time-ago"[^>]*title="([^"]+)"/i);
  if (titleAttr) return titleAttr[1].trim();
  const spanContent = html.match(/data-hook="time-ago"[^>]*>([\s\S]*?)<\/span>/i);
  if (spanContent) return stripTags(spanContent[1]);
  return "";
}

function thumbnailFromHtml(html) {
  const source = postDescriptionHtml(html) || html;
  const imageInfo = source.match(/"imageData":\{"width":\d+,"height":\d+,"uri":"([^"]+)"/i);
  if (imageInfo?.[1]) return imageInfo[1];
  const direct = source.match(/https?:\/\/static\.wixstatic\.com\/media\/[^"'\s<>]+/i);
  if (direct) return direct[0];
  const youtubeThumb = source.match(/https?:\/\/i\.ytimg\.com\/[^"'\s<>]+?\.(?:jpg|jpeg|png|webp)/i);
  if (youtubeThumb) return youtubeThumb[0].replace(/[),.;]+$/, "");
  return "";
}

function thumbnailFromOgImage(html) {
  if (!html) return "";
  const match =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (!match?.[1]) return "";
  return match[1];
}

function thumbnailFromContentAsset(contentHtml) {
  const match = contentHtml.match(/(344230_[A-Za-z0-9_.~-]+\.(?:jpg|jpeg|png|webp))/i);
  return match ? match[1] : "";
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

  await rm(path.dirname(ORIGINALS_PUBLIC_DIR), { recursive: true, force: true });
  if (existsSync(ORIGINALS_SOURCE_DIR)) {
    await mkdir(path.dirname(ORIGINALS_PUBLIC_DIR), { recursive: true });
    await cp(ORIGINALS_SOURCE_DIR, ORIGINALS_PUBLIC_DIR, { recursive: true });
  }

  if (existsSync(MIRROR_PARASTORAGE_SRC)) {
    await rm(MIRROR_PARASTORAGE_PUBLIC, { recursive: true, force: true });
    await cp(MIRROR_PARASTORAGE_SRC, MIRROR_PARASTORAGE_PUBLIC, { recursive: true });
  }
  if (existsSync(MIRROR_WIXSTATIC_SRC)) {
    await rm(MIRROR_WIXSTATIC_PUBLIC, { recursive: true, force: true });
    await cp(MIRROR_WIXSTATIC_SRC, MIRROR_WIXSTATIC_PUBLIC, { recursive: true });
  }

  const files = await listHtmlFiles(CONTENT_ROOT);
  const blogHtml = await readFile(path.join(RAW_SOURCE_ROOT, "blog.html"), "utf-8").catch(() => "");
  const posts = [];

  for (const file of files) {
    const relative = path.relative(CONTENT_ROOT, file).replace(/\\/g, "/");
    const slug = relative.replace(/\.html$/i, "");
    const html = await readFile(file, "utf-8");
    const mirrorHtml = await readFile(path.join(RAW_SOURCE_ROOT, "post", `${slug}.html`), "utf-8").catch(
      () => ""
    );
    const title = titleFromHtml(html, slug);
    const youtubeUrl = youtubeFromHtml(html) || youtubeFromHtml(mirrorHtml);
    const excerpt = normalizeExcerpt(excerptFromHtml(html), title, youtubeUrl);
    const contentHtml = postBodyHtml(html);
    const youtubePoster = youtubePosterFromUrl(youtubeUrl);
    const thumbnailCandidate =
      THUMBNAIL_OVERRIDES[slug] ||
      thumbnailFromOgImage(mirrorHtml) ||
      thumbnailFromHtml(html) ||
      thumbnailFromContentAsset(contentHtml) ||
      youtubePoster;
    const thumbnailUrl = resolveThumbnailUrl(slug, thumbnailCandidate, contentHtml);

    posts.push({
      slug,
      title,
      publishedAt: publishedFromHtml(html) || publishedFromHtml(mirrorHtml),
      thumbnailUrl,
      excerpt,
      youtubeUrl,
      contentHtml
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
  const withThumb = posts.filter((post) => post.thumbnailUrl).length;
  console.log(
    `Posts importados a Astro: ${posts.length}. Thumbnails: ${withThumb}/${posts.length}. Mirror raw copiado a public/raw.`
  );
}

main().catch((error) => {
  console.error("Error importando contenido:", error);
  process.exit(1);
});
