import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "core/index": "packages/core/src/index.ts",
    "cli/bin": "packages/cli/src/bin.ts",
    "cli/index": "packages/cli/src/index.ts",
    "fmt/index": "packages/fmt/src/index.ts",
    "linter/index": "packages/linter/src/index.ts",
    "fixer/index": "packages/fixer/src/index.ts",
    "pkg/index": "packages/pkg/src/index.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "esnext",
  outDir: "dist",
  platform: "node",
  shims: false,
});
