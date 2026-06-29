import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      // Backward compat: old media URLs stored as /uploads/... in DB → API route
      { source: "/uploads/:path*", destination: "/api/uploads/:path*" },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/leads",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
