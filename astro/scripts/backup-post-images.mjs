import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const POSTS_FILE = path.join(ROOT, "src", "data", "posts.json");
const BACKUP_ROOT = path.join(ROOT, "public", "backup", "post");

function usage() {
  console.log("Uso:");
  console.log("  node scripts/backup-post-images.mjs --all");
  console.log('  node scripts/backup-post-images.mjs --slug "mi-slug"');
}

function parseArgs(argv) {
  const args = { all: false, slug: "" };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--all") {
      args.all = true;
      continue;
    }
    if (token === "--slug") {
      args.slug = argv[i + 1] || "";
      i += 1;
    }
  }
  return args;
}

function collectAssetIds(text) {
  if (!text) return [];
  const matches = [...text.matchAll(/(344230_[A-Za-z0-9_.~-]+\.(?:jpg|jpeg|png|webp))/g)];
  return matches.map((m) => m[1]).filter(Boolean);
}

function buildDownloadUrls(post) {
  const ids = new Set();

  for (const id of collectAssetIds(post.contentHtml || "")) ids.add(id);
  for (const id of collectAssetIds(post.thumbnailUrl || "")) ids.add(id);

  return [...ids]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((id) => `https://static.wixstatic.com/media/${id}`);
}

async function downloadFile(url, outputFile) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; FenicioBackup/1.0)"
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputFile, buffer);
  return buffer.length;
}

async function backupPost(post) {
  const urls = buildDownloadUrls(post);
  const outDir = path.join(BACKUP_ROOT, post.slug, "maxres");
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let downloaded = 0;
  let failed = 0;
  const details = [];

  for (const url of urls) {
    const fileName = url.split("/").pop();
    const outFile = path.join(outDir, fileName);
    try {
      const size = await downloadFile(url, outFile);
      downloaded += 1;
      details.push({ url, fileName, status: "ok", size });
      console.log(`OK   ${post.slug} :: ${fileName} (${size} bytes)`);
    } catch (error) {
      failed += 1;
      details.push({ url, fileName, status: "fail", error: String(error) });
      console.log(`FAIL ${post.slug} :: ${fileName} (${String(error)})`);
    }
  }

  await writeFile(path.join(outDir, "manifest.txt"), urls.join("\n") + (urls.length ? "\n" : ""), "utf-8");
  await writeFile(path.join(outDir, "report.json"), JSON.stringify(details, null, 2), "utf-8");

  return { slug: post.slug, urls: urls.length, downloaded, failed };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.all && !args.slug) {
    usage();
    process.exit(1);
  }

  const posts = JSON.parse(await readFile(POSTS_FILE, "utf-8"));
  const selected = args.all ? posts : posts.filter((p) => p.slug === args.slug);

  if (!selected.length) {
    console.error("No hay posts para procesar con los parámetros indicados.");
    process.exit(1);
  }

  const summary = [];
  for (const post of selected) {
    summary.push(await backupPost(post));
  }

  const totals = summary.reduce(
    (acc, row) => {
      acc.posts += 1;
      acc.urls += row.urls;
      acc.downloaded += row.downloaded;
      acc.failed += row.failed;
      return acc;
    },
    { posts: 0, urls: 0, downloaded: 0, failed: 0 }
  );

  await mkdir(path.join(ROOT, "public", "backup"), { recursive: true });
  await writeFile(
    path.join(ROOT, "public", "backup", "summary-all-posts.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), totals, posts: summary }, null, 2),
    "utf-8"
  );

  console.log(
    `Backup completado. Posts: ${totals.posts}, URLs: ${totals.urls}, descargadas: ${totals.downloaded}, fallidas: ${totals.failed}.`
  );
}

main().catch((error) => {
  console.error("Error en backup de imágenes:", error);
  process.exit(1);
});
