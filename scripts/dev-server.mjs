import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".bin": "application/octet-stream"
};

/** Rutas CDN hermanas del mirror (enlaces ../static.*.com desde dist/). */
const ASSET_ROOTS = [
  { prefix: "/static.parastorage.com", dir: path.join(ROOT, "static.parastorage.com") },
  { prefix: "/static.wixstatic.com", dir: path.join(ROOT, "static.wixstatic.com") },
  { prefix: "/originals", dir: path.join(ROOT, "originals") }
];

function resolveAssetPath(urlPath) {
  for (const { prefix, dir } of ASSET_ROOTS) {
    if (urlPath === prefix || urlPath.startsWith(`${prefix}/`)) {
      const rel = urlPath.slice(prefix.length) || "/";
      return path.normalize(path.join(dir, rel));
    }
  }
  return null;
}

function resolveDistPath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const relative = clean === "/" ? "/index.html" : clean;
  return path.normalize(path.join(DIST_DIR, relative));
}

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

    const assetPath = resolveAssetPath(urlPath);
    if (assetPath) {
      if (!ASSET_ROOTS.some(({ dir }) => assetPath.startsWith(dir))) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const content = await readFile(assetPath);
      const ext = path.extname(assetPath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(content);
      return;
    }

    let filePath = resolveDistPath(urlPath);
    if (!filePath.startsWith(DIST_DIR)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    try {
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
    } catch {
      filePath = path.join(DIST_DIR, "index.html");
    }

    const content = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}).listen(PORT, () => {
  console.log(`Servidor local en http://127.0.0.1:${PORT}`);
  console.log("(Sirve dist/ + static.parastorage.com + static.wixstatic.com del mirror)");
});
