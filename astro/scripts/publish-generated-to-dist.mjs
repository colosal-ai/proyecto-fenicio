import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED = path.join(ROOT, ".generated");
const DIST = path.join(ROOT, "dist");

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
  console.log("Publicado en dist/: raw/, static.*, originals/ (desde .generated/).");
}

main().catch((error) => {
  console.error("Error publicando .generated → dist:", error);
  process.exit(1);
});
