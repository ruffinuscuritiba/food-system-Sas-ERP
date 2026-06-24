import "./globals.css";
import ClientShell from "@/components/ClientShell";
import { PlatformAnalytics } from "@/components/PlatformAnalytics";

export const metadata = {
  title: "FoodSaaS ERP",
  description: "Sistema de gestão para restaurantes",
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
