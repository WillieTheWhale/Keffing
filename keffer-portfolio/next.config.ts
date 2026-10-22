import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // "" on a custom domain; "/Keffing" on williethewhale.github.io (set by the
  // deploy workflow from actions/configure-pages). See lib/basePath.ts.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  transpilePackages: ["three"],
  images: {
    formats: ["image/webp", "image/avif"],
    unoptimized: true,
  },
};

export default nextConfig;
