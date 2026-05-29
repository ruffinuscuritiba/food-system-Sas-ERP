import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build identifier shown in the sidebar (Vercel injects VERCEL_GIT_COMMIT_SHA automatically)
  env: {
    NEXT_PUBLIC_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
      process.env.COMMIT_SHA?.slice(0, 7) ||
      "dev",
  },
  // Necessário para rodar Next.js dentro de Docker (docker-compose local)
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error"] }
      : false,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "food-system-backend-no7d.onrender.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.unsplash.com" },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@hello-pangea/dnd",
      "framer-motion",
    ],
  },
};

export default nextConfig;
