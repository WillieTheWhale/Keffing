import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // "" on a custom domain; "/Keffing" on williethewhale.github.io (set by the
  // deploy workflow from actions/configure-pages). See lib/basePath.ts.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  transpilePackages: ["three", "@react-three/drei"],
  images: {
    formats: ["image/webp", "image/avif"],
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.glsl": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
      "*.vert": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
      "*.frag": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
