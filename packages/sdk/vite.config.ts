import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    clean: true,
    dts: true,
    entry: {
      index: "src/index.ts",
    },
    format: ["esm"],
    outDir: "dist",
    platform: "node",
    sourcemap: false,
    target: "node20",
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
