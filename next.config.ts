import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "bcryptjs"],
  allowedDevOrigins: ["*.trycloudflare.com"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    cpus: 1,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "galaxylaboratoriesunani.com.bd" },
    ],
  },
};


export default nextConfig;
