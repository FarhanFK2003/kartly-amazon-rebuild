import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All product imagery is downloaded into /public at catalog-build time, so the
  // deployed app never depends on a third-party image host at runtime.
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
