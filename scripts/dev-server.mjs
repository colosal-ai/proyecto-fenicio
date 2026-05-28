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
  ".ico": "image/x-icon"
};

function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const relative = clean === "/" ? "/index.html" : clean;
  const fullPath = path.join(DIST_DIR, relative);
  return path.normalize(fullPath);
}

createServer(async (req, res) => {
  try {
    const requested = resolvePath(req.url || "/");
    if (!requested.startsWith(DIST_DIR)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    let filePath = requested;
    let fileStat;

    try {
      fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
    } catch {
      filePath = path.join(DIST_DIR, "index.html");
    }

    const content = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}).listen(PORT, () => {
  console.log(`Servidor local en http://127.0.0.1:${PORT}`);
});
