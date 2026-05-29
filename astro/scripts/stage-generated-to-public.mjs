/**
 * Copia .generated/ → public/ para astro dev (gitignored). Producción usa publish:generated → dist/.
 */
import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED = path.join(ROOT, ".generated");
const STAGES = ["raw", "static.parastorage.com", "static.wixstatic.com", "originals"];

async function main() {
  try {
    await access(path.join(GENERATED, "raw"));
  } catch {
    console.error("Falta .generated/raw. Ejecuta: npm run sync:content && npm run link:assets");
    process.exit(1);
  }

  for (const name of STAGES) {
    const src = path.join(GENERATED, name);
    const dest = path.join(ROOT, "public", name);
    await rm(dest, { recursive: true, force: true });
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest, { recursive: true, force: true });
  }
  console.log("Staging .generated/ → public/ (solo dev local).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
