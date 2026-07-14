import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "5036" },
      { protocol: "https", hostname: "localhost", port: "5036" },
      { protocol: "http", hostname: "127.0.0.1", port: "5036" },
      { protocol: "https", hostname: "127.0.0.1", port: "5036" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "sefexcorpsist.sefexcorp.com", port: "2000" },
    ]
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"]
  }
};

export default nextConfig;