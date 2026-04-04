import { createMDX } from "fumadocs-mdx/next";
import path from "node:path";

const withMDX = createMDX();
const docsBasePath = process.env.NEXT_PUBLIC_DOCS_BASE_PATH?.trim() ?? "";

/** @type {import('next').NextConfig} */
const config = {
  basePath: docsBasePath && docsBasePath !== "/" ? docsBasePath.replace(/\/+$/, "") : "",
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default withMDX(config);
