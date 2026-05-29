import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED = path.join(ROOT, ".generated");
const DIST = path.join(ROOT, "dist");
const RAW_GENERATED = path.join(GENERATED, "raw");

/** Páginas Wix servidas también en la raíz (/index.html → /, /equipo.html, …). */
const ROOT_HTML_PAGES = ["index.html", "equipo.html", "embarcación.html", "contacto.html"];

const STAGES = [
  { from: "raw", to: "raw" },
  { from: "static.parastorage.com", to: "static.parastorage.com" },
  { from: "static.wixstatic.com", to: "static.wixstatic.com" },
  { from: "originals", to: "originals" }
];

async function main() {
  await mkdir(DIST, { recursive: true });
  for (const { from, to } of STAGES) {
    const src = path.join(GENERATED, from);
    const dest = path.join(DIST, to);
    await cp(src, dest, { recursive: true, force: true });
  }

  for (const name of ROOT_HTML_PAGES) {
    const src = path.join(RAW_GENERATED, name);
    try {
      await access(src);
      await cp(src, path.join(DIST, name), { force: true });
    } catch {
      // página opcional en el mirror
    }
  }

  console.log(
    "Publicado en dist/: raw/, static.*, originals/ y copia raíz de " +
      ROOT_HTML_PAGES.join(", ")
  );
}

main().catch((error) => {
  console.error("Error publicando .generated → dist:", error);
  process.exit(1);
});
