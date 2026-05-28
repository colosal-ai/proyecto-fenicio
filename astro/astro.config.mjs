import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  outDir: "./dist",
  site: "https://www.fenicio.es",
  trailingSlash: "ignore"
});
