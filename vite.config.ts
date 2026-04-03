import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    clean: true,
    dts: false,
    entry: {
      cli: "index.ts",
    },
    format: ["esm"],
    outDir: "dist",
    outExtensions() {
      return {
        js: ".js",
      };
    },
    platform: "node",
    sourcemap: false,
    target: "node20",
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
