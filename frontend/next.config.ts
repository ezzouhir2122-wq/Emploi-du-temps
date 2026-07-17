import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer est ESM-only et ne peut pas être bundlé par Turbopack
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
