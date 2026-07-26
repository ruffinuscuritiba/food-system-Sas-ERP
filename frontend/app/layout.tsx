import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientShell from "@/components/ClientShell";
import { PlatformAnalytics } from "@/components/PlatformAnalytics";

// FIX: antes o manifest.json existia em /public mas nunca era referenciado
// aqui — por isso o navegador não sabia que existia um app instalável e o
// prompt de "Instalar app" (Android) / "Adicionar à Tela de Início" (iOS)
// não tinha as informações certas (ícone, nome, cor) para aparecer direito.
export const metadata: Metadata = {
  title: "R_FoodSaaS ERP",
  description: "Sistema de gestão para restaurantes",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    // iOS (Safari) não lê o manifest.json para decidir o ícone da tela de
    // início — precisa dessa tag separada (apple-touch-icon).
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Entregador",
  },
};

// FIX: themeColor precisa estar no export `viewport` (Next.js 14+), não
// dentro de `metadata` — colocá-lo no lugar errado faz o navegador ignorar
// silenciosamente a cor da barra de status/instalação.
export const viewport: Viewport = {
  themeColor: "#f97316",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900">
        <PlatformAnalytics />
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}