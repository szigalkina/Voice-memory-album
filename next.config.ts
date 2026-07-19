import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM assets that break when bundled — load it from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
