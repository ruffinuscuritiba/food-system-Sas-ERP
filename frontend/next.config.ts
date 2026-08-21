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
      { protocol: "https", hostname: "api.srv1747711.hstgr.cloud" },
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
  // Piloto de padronização de URL cross-produto (SaaS-Control-Center reúne
  // Food/Estética/Oficina/Moda): toda rota também responde sob /food/...,
  // sem mover nenhum arquivo de página nem quebrar link já compartilhado
  // (QR Code de mesa, cardápio digital) — aditivo, /login e /food/login
  // servem exatamente o mesmo conteúdo. middleware.ts normaliza o prefixo
  // antes de checar rota pública/autenticação.
  async rewrites() {
    return [
      { source: "/food", destination: "/" },
      { source: "/food/:path*", destination: "/:path*" },
    ];
  },
};

export default nextConfig;
