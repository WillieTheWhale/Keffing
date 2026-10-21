// The site can be served from a sub-path: GitHub Pages without a custom
// domain publishes it at williethewhale.github.io/Keffing. The deploy workflow
// passes that prefix in as NEXT_PUBLIC_BASE_PATH ("" on a custom domain).
// Next.js prefixes its own scripts, CSS, <Link> and router navigation with
// `basePath`, but not plain string URLs, so every hand-written public asset
// path and raw <a href> goes through withBase().

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a root-relative public path ("/assets/...") with the base path. */
export const withBase = (path: string) => (path.startsWith("/") ? BASE_PATH + path : path);
