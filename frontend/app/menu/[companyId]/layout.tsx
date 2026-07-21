import type { Metadata } from "next";

/**
 * Server Component só pra gerar metadados por loja (título, og:image etc)
 * — page.tsx precisa continuar "use client" (estado do carrinho, checkout),
 * e generateMetadata só funciona em Server Component. companyId aceita
 * slug ou id real (mesma resolução que o backend já faz em /company/:id).
 */

async function fetchCompanyMeta(companyId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  try {
    const [companyRes, themeRes] = await Promise.all([
      fetch(`${apiUrl}/company/${companyId}`, { next: { revalidate: 300 } }),
      fetch(`${apiUrl}/themes/${companyId}`, { next: { revalidate: 300 } }),
    ]);
    const company = companyRes.ok ? await companyRes.json() : null;
    const theme = themeRes.ok ? await themeRes.json() : null;
    return { company, theme };
  } catch {
    return { company: null, theme: null };
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ companyId: string }> }
): Promise<Metadata> {
  const { companyId } = await params;
  const { company, theme } = await fetchCompanyMeta(companyId);

  const name = company?.name?.trim() || "Cardápio Digital";
  const title = `${name} - Cardápio Digital`;
  const description =
    company?.description?.trim() ||
    `Peça agora pelo cardápio digital de ${name}. Delivery, retirada ou mesa, sem taxa de comissão.`;
  // Lojas antigas às vezes têm logo/banner salvos como data: URI (base64
  // direto no banco, em vez de upload real) — og:image do WhatsApp/Facebook
  // exige uma URL http(s) de verdade que o crawler consiga baixar; uma data:
  // URI é ignorada silenciosamente por eles, então nem tenta.
  const rawImage: string | undefined = theme?.bannerUrl || theme?.logoUrl || undefined;
  const image = rawImage?.startsWith("http") ? rawImage : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
