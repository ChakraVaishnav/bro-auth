import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/core/index.js" },
    format: ["esm", "cjs"],
    platform: "node",
    outDir: "dist",
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: false,
    minify: false,
  },
  {
    entry: { browser: "src/browser/index.js" },
    format: ["esm", "cjs"],
    platform: "browser",
    outDir: "dist",
    splitting: false,
    sourcemap: false,
    clean: false,
    dts: false,
    minify: false,
  },
]);
