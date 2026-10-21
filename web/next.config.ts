import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The GLB AI Suite dashboard is a static app in public/suite (v0.8 as handed over).
  async rewrites() {
    return [{ source: "/suite", destination: "/suite/index.html" }];
  },
  async headers() {
    return [
      { source: "/suite/:path*", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "X-Frame-Options", value: "DENY" }, { key: "Permissions-Policy", value: "microphone=(), geolocation=(self), camera=(self)" }] },
      { source: "/suite/sw.js", headers: [{ key: "Service-Worker-Allowed", value: "/suite/" }, { key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
