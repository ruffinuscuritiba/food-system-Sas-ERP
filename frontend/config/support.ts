export const SUPPORT_WHATSAPP = "5541988729370";

export interface SupportMessageOpts {
  companyName?: string;
  plan?: string;
  route?: string;
}

export function buildSupportMessage(opts?: SupportMessageOpts): string {
  const loja = opts?.companyName || "Não identificada";
  const plano = opts?.plan || "Não identificado";
  const pagina =
    opts?.route ||
    (typeof window !== "undefined" ? window.location.pathname : "—");
  return `Olá Kely!\n\nLoja: ${loja}\nPlano: ${plano}\nPágina: ${pagina}\n\nPreciso de ajuda com:`;
}

export function buildSupportUrl(opts?: SupportMessageOpts): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    buildSupportMessage(opts),
  )}`;
}
