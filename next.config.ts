import type { NextConfig } from "next";

// Strict, minimal config. Server-only secrets are read via process.env in
// server code and are never exposed to the client bundle.
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
