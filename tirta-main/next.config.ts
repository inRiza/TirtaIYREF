import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Disable Turbopack for next-pwa compatibility
  turbopack: {},
};

export default nextConfig;
