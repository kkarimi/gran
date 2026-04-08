export const appName = "Gran 👵🏻";
export const docsRoute = "/docs";
export const docsImageRoute = "/og/docs";
export const docsContentRoute = "/llms.mdx/docs";
export const docsSearchRoute = "/api/search";

const configuredBasePath = process.env.NEXT_PUBLIC_DOCS_BASE_PATH?.trim() ?? "";
export const docsBasePath =
  configuredBasePath && configuredBasePath !== "/" ? configuredBasePath.replace(/\/+$/, "") : "";
export const docsSiteUrl =
  process.env.NEXT_PUBLIC_DOCS_SITE_URL?.trim() || "https://kkarimi.github.io/gran";

function withDocsBasePath(path: string): string {
  return `${docsBasePath}${path}` || "/";
}

export const docsPublicRoute = withDocsBasePath(docsRoute);
export const docsImagePublicRoute = withDocsBasePath(docsImageRoute);
export const docsContentPublicRoute = withDocsBasePath(docsContentRoute);
export const docsSearchPublicRoute = withDocsBasePath(docsSearchRoute);

export const gitConfig = {
  user: "kkarimi",
  repo: "gran",
  branch: "main",
};
