import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
